package com.contractscan.backend.service;

import com.contractscan.backend.model.User;
import com.contractscan.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class OAuth2UserService extends DefaultOAuth2UserService {

    private final UserRepository userRepository;

    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) {
        OAuth2User oAuth2User = super.loadUser(userRequest);

        String email = oAuth2User.getAttribute("email");
        String name = oAuth2User.getAttribute("name");

        // Save or update user in database
        userRepository.findByEmail(email).ifPresentOrElse(
            existingUser -> {
                log.info("Existing user logged in: {}", email);
            },
            () -> {
                User newUser = new User();
                newUser.setEmail(email);
                newUser.setName(name);
                newUser.setAuthProvider("google");
                newUser.setTier("free");
                userRepository.save(newUser);
                log.info("New user created: {}", email);
            }
        );

        return oAuth2User;
    }
}