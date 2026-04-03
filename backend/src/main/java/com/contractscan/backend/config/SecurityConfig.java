
package com.contractscan.backend.config;
import lombok.RequiredArgsConstructor;
import com.contractscan.backend.service.OAuth2UserService;

import jakarta.servlet.http.HttpServletResponse;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.security.oauth2.core.user.OAuth2User;

import lombok.RequiredArgsConstructor;

import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {
    private final OAuth2UserService oAuth2UserService;
    @Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
        .cors(cors -> cors.configurationSource(corsConfigurationSource()))
        .csrf(csrf -> csrf.ignoringRequestMatchers("/api/contracts/upload").disable())
        .sessionManagement(session -> session
            .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
        )
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/api/contracts/upload").permitAll()
            .requestMatchers("/api/contracts/results/**").permitAll()
            .requestMatchers("/api/contracts/me").permitAll()
            .anyRequest().permitAll()
        )
    .exceptionHandling(exceptions -> exceptions
            .authenticationEntryPoint((request, response, authException) -> {
                // If a guest hits a protected page, don't 401, just let them be "Anonymous"
                response.setStatus(HttpServletResponse.SC_OK); 
            })
        )
        .oauth2Login(oauth2 -> oauth2
    .userInfoEndpoint(userInfo -> userInfo
        .userService(oAuth2UserService) // KEEP THIS - it handles your DB logic
    )
    .successHandler((request, response, authentication) -> {
        // Change this to the FULL URL of your frontend to bypass the 404
        response.sendRedirect("http://localhost:5173/"); 
    })
    .failureUrl("http://localhost:5173?error=true")
)
.logout(logout -> logout
            .logoutSuccessUrl("http://localhost:5173/")
            .invalidateHttpSession(true)
            .clearAuthentication(true)
            .deleteCookies("JSESSIONID")
            .permitAll()
);

    return http.build();
}

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("http://localhost:5173", "http://localhost:5174"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        return source -> {
            UrlBasedCorsConfigurationSource s = new UrlBasedCorsConfigurationSource();
            s.registerCorsConfiguration("/**", config);
            return s.getCorsConfiguration(source);
        };
    }
}