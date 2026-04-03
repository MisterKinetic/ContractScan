package com.contractscan.backend.service;

import com.contractscan.backend.dto.ContractHistoryDto;
import com.contractscan.backend.dto.ContractResultsResponse;
import com.contractscan.backend.dto.ContractUploadResponse;
import com.contractscan.backend.model.Contract;
import com.contractscan.backend.model.LegalFinding;
import com.contractscan.backend.repository.BboxCoordRepository;
import com.contractscan.backend.repository.ContractRepository;
import com.contractscan.backend.repository.LegalFindingRepository;
import com.contractscan.backend.repository.UserRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.user.OAuth2User;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;
import com.contractscan.backend.model.User;

@Service
@RequiredArgsConstructor
@Slf4j
public class ContractService {

    private final ContractRepository contractRepository;
    private final UserRepository userRepository;
    private final LegalFindingRepository legalFindingRepository;
    private final BboxCoordRepository bboxCoordRepository;
    private final RedisTemplate<String, String> redisTemplate;
    private final ProgressWebSocketService progressWebSocketService;

    private static final String UPLOAD_DIR = System.getProperty("user.home") + "/contractscan-uploads/";
    private static final UUID DEV_USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    public ContractUploadResponse uploadContract(MultipartFile file, String userEmail) throws IOException {
        Path uploadPath = Paths.get(UPLOAD_DIR);
        if (!Files.exists(uploadPath)) {
            Files.createDirectories(uploadPath);
        }

        String filename = UUID.randomUUID() + "_" + file.getOriginalFilename();
        Path filePath = uploadPath.resolve(filename);
        file.transferTo(filePath.toFile());

        UUID userId =getUserIdByEmail(userEmail);

        Contract contract = new Contract();
        contract.setUserId(userId);
        contract.setOriginalFilename(file.getOriginalFilename());
        contract.setS3Key(filePath.toString());
        contract.setStatus("uploaded");
        contract = contractRepository.save(contract);
        progressWebSocketService.subscribeToContract(contract.getId());


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

        long total = redCount + yellowCount + greenCount;
        int riskScore = total > 0
            ? (int) ((redCount * 100 + yellowCount * 40) / total)
            : 0;

        List<ContractResultsResponse.FindingDto> findingDtos = findings.stream()
    .map(f -> {
        List<ContractResultsResponse.FindingDto.BboxDto> bboxList = new java.util.ArrayList<>();
        if (f.getClauseChunkId() != null) {
            bboxList = bboxCoordRepository.findByChunkId(f.getClauseChunkId())
                .stream()
                .map(b -> new ContractResultsResponse.FindingDto.BboxDto(
                    b.getPageNumber(),
                    b.getX(),
                    b.getY(),
                    b.getWidth(),
                    b.getHeight()
                ))
                .toList();
        }
        return new ContractResultsResponse.FindingDto(
            f.getId(),
            f.getRiskLevel(),
            f.getClauseType(),
            f.getPlainEnglishText(),
            f.getSuggestedAlternative(),
            f.getConfidenceScore(),
            bboxList
        );
    })
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

   private UUID getUserIdFromAuth(Authentication authentication) {
    log.info("Authentication: {}", authentication);
    log.info("Principal: {}", authentication != null ? authentication.getPrincipal() : "null");
    try {
        if (authentication != null && authentication.getPrincipal() instanceof OAuth2User oAuth2User) {
            String email = oAuth2User.getAttribute("email");
            return userRepository.findByEmail(email)
                .map(User::getId)
                .orElse(getDevUserId());
        }
    } catch (Exception e) {
        log.warn("Could not get user from auth: {}", e.getMessage());
    }
    return getDevUserId();
}

private UUID getDevUserId() {
    return userRepository.findAll().stream()
        .findFirst()
        .map(User::getId)
        .orElse(UUID.fromString("00000000-0000-0000-0000-000000000001"));
}
private UUID getUserIdByEmail(String email) {
    if (email != null) {
        return userRepository.findByEmail(email)
            .map(User::getId)
            .orElse(getDevUserId());
    }
    return getDevUserId();
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

    public Contract getContractById(UUID contractId) {
        return contractRepository.findById(contractId)
            .orElseThrow(() -> new RuntimeException("Contract not found"));
    }

    public List<ContractHistoryDto> getUserHistory(String email) {
        UUID userId = getUserIdByEmail(email);
        List<Contract> contracts = contractRepository.findByUserIdOrderByCreatedAtDesc(userId);

        return contracts.stream().map(c -> {
            long redCount = legalFindingRepository.countByContractIdAndRiskLevel(c.getId(), "red");
            long yellowCount = legalFindingRepository.countByContractIdAndRiskLevel(c.getId(), "yellow");
            long greenCount = legalFindingRepository.countByContractIdAndRiskLevel(c.getId(), "green");

            long total = redCount + yellowCount + greenCount;
            int riskScore = total > 0
                ? (int) ((redCount * 100 + yellowCount * 40) / total)
                : 0;

            return new ContractHistoryDto(
                c.getId(),
                c.getOriginalFilename(),
                c.getCreatedAt(),
                riskScore,
                c.getStatus()
            );
        }).toList();
    }
}