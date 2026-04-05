package com.contractscan.backend.controller;

import com.contractscan.backend.dto.ContractResultsResponse;
import com.contractscan.backend.service.ContractService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/share")
@CrossOrigin(origins = "http://localhost:5173", allowCredentials = "true")
@RequiredArgsConstructor
public class ShareController {

    private final ContractService contractService;

    @GetMapping("/{token}")
    public ResponseEntity<ContractResultsResponse> getSharedResults(@PathVariable String token) {
        try {
            return ResponseEntity.ok(contractService.getResultsByShareToken(token));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
