package com.contractscan.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import java.util.UUID;

@Data
@AllArgsConstructor
public class ContractUploadResponse {
    private UUID contractId;
    private String status;
    private String message;
}