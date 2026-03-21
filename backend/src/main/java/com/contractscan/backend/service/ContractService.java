package com.contractscan.backend.service;

import com.contractscan.backend.dto.ContractResultsResponse;
import com.contractscan.backend.dto.ContractUploadResponse;
import com.contractscan.backend.model.Contract;
import com.contractscan.backend.model.LegalFinding;
import com.contractscan.backend.repository.ContractRepository;
import com.contractscan.backend.repository.LegalFindingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ContractService {

    private final ContractRepository contractRepository;
    private final LegalFindingRepository legalFindingRepository;
    private final RedisTemplate<String, String> redisTemplate;

    private static final String UPLOAD_DIR = "C:/Users/ahmed/Desktop/ContractScan/files/backend/uploads/";
    private static final UUID DEV_USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    public ContractUploadResponse uploadContract(MultipartFile file) throws IOException {
        // Create uploads directory if it doesn't exist
        Path uploadPath = Paths.get(UPLOAD_DIR);
        if (!Files.exists(uploadPath)) {
            Files.createDirectories(uploadPath);
        }

        // Save file locally (will be S3 in production)
        String filename = UUID.randomUUID() + "_" + file.getOriginalFilename();
        Path filePath = uploadPath.resolve(filename);
        file.transferTo(filePath.toFile());

        // Get dev user id from database
        UUID userId = getDevUserId();

        // Create contract record in database
        Contract contract = new Contract();
        contract.setUserId(userId);
        contract.setOriginalFilename(file.getOriginalFilename());
        contract.setS3Key(filePath.toString());
        contract.setStatus("uploaded");
        contract = contractRepository.save(contract);

        // Push job to Redis queue
        String jobMessage = contract.getId().toString() + "|" + filePath.toString();
        redisTemplate.opsForList().leftPush("contractscan:jobs", jobMessage);

        log.info("Contract uploaded and queued: {}", contract.getId());

        return new ContractUploadResponse(
            contract.getId(),
            "uploaded",
            "Contract uploaded successfully. Analysis started."
        );
    }

    public ContractUploadResponse getStatus(UUID contractId) {
        Contract contract = contractRepository.findById(contractId)
            .orElseThrow(() -> new RuntimeException("Contract not found"));

        return new ContractUploadResponse(
            contract.getId(),
            contract.getStatus(),
            getStatusMessage(contract.getStatus())
        );
    }

    public ContractResultsResponse getResults(UUID contractId) {
        Contract contract = contractRepository.findById(contractId)
            .orElseThrow(() -> new RuntimeException("Contract not found"));

        List<LegalFinding> findings = legalFindingRepository
            .findByContractIdOrderByRiskLevelAsc(contractId);

        long redCount = legalFindingRepository.countByContractIdAndRiskLevel(contractId, "red");
        long yellowCount = legalFindingRepository.countByContractIdAndRiskLevel(contractId, "yellow");
        long greenCount = legalFindingRepository.countByContractIdAndRiskLevel(contractId, "green");

        // Calculate risk score 0-100
        long total = redCount + yellowCount + greenCount;
        int riskScore = total > 0
            ? (int) ((redCount * 100 + yellowCount * 40) / total)
            : 0;

        List<ContractResultsResponse.FindingDto> findingDtos = findings.stream()
            .map(f -> new ContractResultsResponse.FindingDto(
                f.getId(),
                f.getRiskLevel(),
                f.getClauseType(),
                f.getPlainEnglishText(),
                f.getSuggestedAlternative(),
                f.getConfidenceScore()
            ))
            .toList();

        return new ContractResultsResponse(
            contract.getId(),
            contract.getStatus(),
            (int) redCount,
            (int) yellowCount,
            (int) greenCount,
            riskScore,
            findingDtos
        );
    }

    private UUID getDevUserId() {
        // In production this comes from JWT token
        // For now return the dev user seeded in init.sql
        try {
            return contractRepository.findAll().stream()
                .findFirst()
                .map(Contract::getUserId)
                .orElse(DEV_USER_ID);
        } catch (Exception e) {
            return DEV_USER_ID;
        }
    }

    private String getStatusMessage(String status) {
        return switch (status) {
            case "uploaded" -> "Contract uploaded, waiting for analysis";
            case "processing" -> "Analysis in progress...";
            case "stage1_complete" -> "PDF parsed, running AI analysis...";
            case "complete" -> "Analysis complete";
            case "failed" -> "Analysis failed, please try again";
            default -> "Unknown status";
        };
    }
}