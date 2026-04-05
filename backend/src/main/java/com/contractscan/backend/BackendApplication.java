package com.contractscan.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.core.env.Environment;

import io.github.cdimascio.dotenv.Dotenv;

@SpringBootApplication
@EnableScheduling
public class BackendApplication {
    public static void main(String[] args) {
        try {
            Dotenv dotenv = Dotenv.configure()
                .directory("./")
                .ignoreIfMissing()
                .load();
            dotenv.entries().forEach(entry -> {
                if (System.getProperty(entry.getKey()) == null) {
                    System.setProperty(entry.getKey(), entry.getValue());
                }
            });
        } catch (Exception e) {
            System.err.println("Could not load .env: " + e.getMessage());
        }
        SpringApplication.run(BackendApplication.class, args);
    }

    @Bean
    public CommandLineRunner debugEnv(Environment env) {
        return args -> {
            System.out.println("DEBUG: GOOGLE_CLIENT_ID = " + env.getProperty("GOOGLE_CLIENT_ID"));
            System.out.println("DEBUG: oauth2 client-id = " + env.getProperty("spring.security.oauth2.client.registration.google.client-id"));
        };
    }
}
