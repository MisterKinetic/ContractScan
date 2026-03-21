package com.contractscan.backend.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Paths;
import java.util.UUID;

@Service
@Slf4j
public class PythonPipelineService {

    private static final String AI_WORKER_PATH =
        Paths.get("../ai-worker").toAbsolutePath().toString();

    public void runPipeline(UUID contractId, String filePath) {
        // Run in background thread so API stays responsive
        Thread.ofVirtual().start(() -> {
            try {
                log.info("Starting pipeline for contract: {}", contractId);

                // Stage 1 + 2: PDF parse + PII redaction
                runScript("worker.py",
                    "--pdf", filePath,
                    "--contract-id", contractId.toString());

                // Stage 3 + 4: Chunking + embeddings
                runScript("embedder.py",
                    "--contract-id", contractId.toString());

                // Stage 5 + 6 + 7: RAG + LLM + coord mapping
                runScript("analyzer.py",
                    "--contract-id", contractId.toString(),
                    "--workers", "4");

                log.info("Pipeline complete for contract: {}", contractId);

            } catch (Exception e) {
                log.error("Pipeline failed for contract {}: {}", contractId, e.getMessage());
            }
        });
    }

    private void runScript(String script, String... args) throws IOException, InterruptedException {
        String venvPython = AI_WORKER_PATH + "\\.venv\\Scripts\\python.exe";
        String scriptPath = AI_WORKER_PATH + "\\" + script;

        String[] command = new String[2 + args.length];
        command[0] = venvPython;
        command[1] = scriptPath;
        System.arraycopy(args, 0, command, 2, args.length);

        ProcessBuilder pb = new ProcessBuilder(command);
        pb.directory(Paths.get(AI_WORKER_PATH).toFile());
        pb.inheritIO(); // Show Python logs in Spring Boot console
        Process process = pb.start();
        int exitCode = process.waitFor();

        if (exitCode != 0) {
            throw new RuntimeException("Script " + script + " failed with exit code " + exitCode);
        }
    }
}