package com.contractscan.backend.repository;

import com.contractscan.backend.model.Contract;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ContractRepository extends JpaRepository<Contract, UUID> {
    List<Contract> findByUserIdOrderByCreatedAtDesc(UUID userId);
    List<Contract> findByStatus(String status);
    Optional<Contract> findByShareToken(String shareToken);
}