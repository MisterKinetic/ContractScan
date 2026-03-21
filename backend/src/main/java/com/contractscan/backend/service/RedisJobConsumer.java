package com.contractscan.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class RedisJobConsumer {

    private final RedisTemplate<String, String> redisTemplate;
    private final PythonPipelineService pythonPipelineService;

    // Check for new jobs every 5 seconds
    @Scheduled(fixedDelay = 5000)
    public void processJobs() {
        String job = redisTemplate.opsForList()
            .rightPop("contractscan:jobs", 1, TimeUnit.SECONDS);

        if (job != null) {
            String[] parts = job.split("\\|", 2);
            if (parts.length == 2) {
                UUID contractId = UUID.fromString(parts[0]);
                String filePath = parts[1];
                log.info("Processing job for contract: {}", contractId);
                pythonPipelineService.runPipeline(contractId, filePath);
            }
        }
    }
}