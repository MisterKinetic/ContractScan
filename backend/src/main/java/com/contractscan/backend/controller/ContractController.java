package com.contractscan.backend.controller;

import com.contractscan.backend.dto.ContractResultsResponse;
import com.contractscan.backend.dto.ContractUploadResponse;
import com.contractscan.backend.model.Contract;
import com.contractscan.backend.service.ContractService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/contracts")
@CrossOrigin(origins = "http://localhost:5173", allowCredentials = "true")
@RequiredArgsConstructor
@Slf4j
public class ContractController {

    private final ContractService contractService;

    @PostMapping("/upload")
public ResponseEntity<?> uploadContract(
        @RequestParam("file") MultipartFile file,
        Authentication authentication) {

    String email;

    // 1. Determine identity: Logged in vs Guest
    if (authentication != null && authentication.isAuthenticated()) {
        if (authentication.getPrincipal() instanceof OAuth2User oauthUser) {
            email = oauthUser.getAttribute("email");
        } else {
            email = authentication.getName();
        }
    } else {
        // Fallback for Guest
        email = "guest@contractscan.local"; 
    }

    // 2. Error Check (only if even guest identification fails somehow)
    if (email == null) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Email not found");
    }

    try {
        log.info("Processing upload for: {}", email);
        // Your existing service call
        ContractUploadResponse response = contractService.uploadContract(file, email);
        return ResponseEntity.ok(response);
    } catch (Exception e) {
        log.error("Upload error: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
    }
}

    @GetMapping("/{contractId}/status")
    public ResponseEntity<ContractUploadResponse> getStatus(@PathVariable UUID contractId) {
        try {
            return ResponseEntity.ok(contractService.getStatus(contractId));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/{contractId}/results")
    public ResponseEntity<ContractResultsResponse> getResults(@PathVariable UUID contractId) {
        try {
            return ResponseEntity.ok(contractService.getResults(contractId));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof OAuth2User user) {
            String email = user.getAttribute("email");
            String name = user.getAttribute("name");
            
            return ResponseEntity.ok(Map.of(
                "loggedIn", true, 
                "email", email,
                "name", name != null ? name : "User"
            ));
        }
        return ResponseEntity.ok(Map.of("loggedIn", false));
    }

    @GetMapping("/user-history")
    public ResponseEntity<?> getUserHistory(Authentication authentication) {
        String email;
        if (authentication != null && authentication.isAuthenticated()) {
            if (authentication.getPrincipal() instanceof OAuth2User oauthUser) {
                email = oauthUser.getAttribute("email");
            } else {
                email = authentication.getName();
            }
        } else {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("User not authenticated");
        }

        try {
            return ResponseEntity.ok(contractService.getUserHistory(email));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    @GetMapping("/{contractId}/pdf")
    public ResponseEntity<Resource> getPdf(@PathVariable UUID contractId) {
        try {
            Contract contract = contractService.getContractById(contractId);
            Path filePath = Paths.get(contract.getS3Key());
            Resource resource = new FileSystemResource(filePath);
            
            if (!resource.exists()) {
                return ResponseEntity.notFound().build();
            }

            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + contract.getOriginalFilename() + "\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(resource);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }
} // <--- This one closes the whole class