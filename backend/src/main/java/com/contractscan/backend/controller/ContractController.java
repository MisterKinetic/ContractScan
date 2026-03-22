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
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

@RestController
@RequestMapping("/api/contracts")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*")
public class ContractController {

    private final ContractService contractService;

    @PostMapping("/upload")
    public ResponseEntity<ContractUploadResponse> uploadContract(
            @RequestParam("file") MultipartFile file) {
        try {
            if (file.isEmpty()) {
                return ResponseEntity.badRequest()
                    .body(new ContractUploadResponse(null, "error", "No file provided"));
            }

            if (!file.getOriginalFilename().toLowerCase().endsWith(".pdf")) {
                return ResponseEntity.badRequest()
                    .body(new ContractUploadResponse(null, "error", "Only PDF files are supported"));
            }

            ContractUploadResponse response = contractService.uploadContract(file);
            return ResponseEntity.ok(response);

        } catch (IOException e) {
            log.error("Upload failed: {}", e.getMessage());
            return ResponseEntity.internalServerError()
                .body(new ContractUploadResponse(null, "error", "Upload failed: " + e.getMessage()));
        }
    }

    @GetMapping("/{contractId}/status")
    public ResponseEntity<ContractUploadResponse> getStatus(
            @PathVariable UUID contractId) {
        try {
            return ResponseEntity.ok(contractService.getStatus(contractId));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/{contractId}/results")
    public ResponseEntity<ContractResultsResponse> getResults(
            @PathVariable UUID contractId) {
        try {
            return ResponseEntity.ok(contractService.getResults(contractId));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
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
            .header(HttpHeaders.CONTENT_DISPOSITION, 
                "inline; filename=\"" + contract.getOriginalFilename() + "\"")
            .contentType(MediaType.APPLICATION_PDF)
            .body(resource);
    } catch (Exception e) {
        return ResponseEntity.notFound().build();
    }
}
}