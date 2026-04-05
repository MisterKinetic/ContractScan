package com.contractscan.backend.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Paths;
import java.util.UUID;

@Service
@Slf4j
public class PythonPipelineService {

    private final String aiWorkerPath;

    public PythonPipelineService(@Value("${ai.worker.path:../ai-worker}") String aiWorkerPath) {
        this.aiWorkerPath = Paths.get(aiWorkerPath).toAbsolutePath().toString();
    }

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
        String venvPython = getPythonExecutable();
        String scriptPath = Paths.get(aiWorkerPath, script).toString();

        log.info("Running script: {} with python: {}", script, venvPython);

        String[] command = new String[2 + args.length];
        command[0] = venvPython;
        command[1] = scriptPath;
        System.arraycopy(args, 0, command, 2, args.length);

        ProcessBuilder pb = new ProcessBuilder(command);
        pb.directory(Paths.get(aiWorkerPath).toFile());
        pb.inheritIO(); // Show Python logs in Spring Boot console
        Process process = pb.start();
        int exitCode = process.waitFor();

        if (exitCode != 0) {
            throw new RuntimeException("Script " + script + " failed with exit code " + exitCode);
        }
    }

    private String getPythonExecutable() {
        boolean isWindows = System.getProperty("os.name").toLowerCase().contains("win");
        if (isWindows) {
            return Paths.get(aiWorkerPath, ".venv", "Scripts", "python.exe").toString();
        } else {
            return Paths.get(aiWorkerPath, ".venv", "bin", "python").toString();
        }
    }
}