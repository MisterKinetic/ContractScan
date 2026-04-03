package com.contractscan.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(unique = true, nullable = false)
    private String email;

    @Column
    private String name;

    @Column(name = "auth_provider")
    private String authProvider;

    @Column
    private String tier;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();
}