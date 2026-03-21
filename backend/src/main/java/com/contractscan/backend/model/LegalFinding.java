package com.contractscan.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "legal_findings")
@Data
@NoArgsConstructor
public class LegalFinding {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "contract_id", nullable = false)
    private UUID contractId;

    @Column(name = "clause_chunk_id")
    private UUID clauseChunkId;

    @Column(name = "bbox_coord_id")
    private UUID bboxCoordId;

    @Column(name = "risk_level", nullable = false)
    private String riskLevel;

    @Column(name = "clause_type", nullable = false)
    private String clauseType;

    @Column(name = "plain_english_text", nullable = false, columnDefinition = "TEXT")
    private String plainEnglishText;

    @Column(name = "suggested_alternative", columnDefinition = "TEXT")
    private String suggestedAlternative;

    @Column(name = "llm_model_used", nullable = false)
    private String llmModelUsed;

    @Column(name = "confidence_score")
    private Double confidenceScore;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}