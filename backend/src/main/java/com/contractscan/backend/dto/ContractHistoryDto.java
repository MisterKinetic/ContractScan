package com.contractscan.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ContractHistoryDto {
    private UUID id;
    private String filename;
    private LocalDateTime createdAt;
    private int riskScore;
    private String status;
}
