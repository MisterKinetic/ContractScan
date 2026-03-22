package com.contractscan.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.UUID;

@Entity
@Table(name = "bbox_coords")
@Data
@NoArgsConstructor
public class BboxCoord {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "contract_id")
    private UUID contractId;

    @Column(name = "page_number")
    private Integer pageNumber;

    @Column(name = "x")
    private Double x;

    @Column(name = "y")
    private Double y;

    @Column(name = "width")
    private Double width;

    @Column(name = "height")
    private Double height;

    @Column(name = "raw_text")
    private String rawText;

    @Column(name = "block_index")
    private Integer blockIndex;
}