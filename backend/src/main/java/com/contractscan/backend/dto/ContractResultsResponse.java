package com.contractscan.backend.dto;

import lombok.Data;
import lombok.AllArgsConstructor;
import java.util.List;
import java.util.UUID;

@Data
@AllArgsConstructor
public class ContractResultsResponse {
    private UUID contractId;
    private String status;
    private int redCount;
    private int yellowCount;
    private int greenCount;
    private int riskScore;
    private List<FindingDto> findings;

    @Data
    @AllArgsConstructor
    public static class FindingDto {
        private UUID id;
        private String riskLevel;
        private String clauseType;
        private String plainEnglish;
        private String suggestion;
        private Double confidence;
        private List<BboxDto> bboxList;

        @Data
        @AllArgsConstructor
        public static class BboxDto {
            private Integer pageNumber;
            private Double x;
            private Double y;
            private Double width;
            private Double height;
        }
    }
}