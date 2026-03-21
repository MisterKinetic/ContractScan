package com.contractscan.backend.repository;

import com.contractscan.backend.model.LegalFinding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.UUID;

@Repository
public interface LegalFindingRepository extends JpaRepository<LegalFinding, UUID> {
    List<LegalFinding> findByContractIdOrderByRiskLevelAsc(UUID contractId);
    List<LegalFinding> findByContractIdAndRiskLevel(UUID contractId, String riskLevel);
    long countByContractIdAndRiskLevel(UUID contractId, String riskLevel);
}