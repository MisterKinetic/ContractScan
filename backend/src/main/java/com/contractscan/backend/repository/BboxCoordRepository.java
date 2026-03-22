package com.contractscan.backend.repository;

import com.contractscan.backend.model.BboxCoord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.UUID;

@Repository
public interface BboxCoordRepository extends JpaRepository<BboxCoord, UUID> {

    @Query(value = "SELECT bc.* FROM bbox_coords bc " +
           "JOIN chunk_bbox_map cbm ON bc.id = cbm.bbox_coord_id " +
           "WHERE cbm.clause_chunk_id = :chunkId " +
           "ORDER BY bc.page_number, bc.block_index", nativeQuery = true)
    List<BboxCoord> findByChunkId(UUID chunkId);
}