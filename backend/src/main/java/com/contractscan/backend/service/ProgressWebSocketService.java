package com.contractscan.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.listener.PatternTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ProgressWebSocketService implements MessageListener {

    private final SimpMessagingTemplate messagingTemplate;
    private final RedisMessageListenerContainer redisListenerContainer;

    public void subscribeToContract(UUID contractId) {
        String channel = "progress:" + contractId.toString();
        redisListenerContainer.addMessageListener(this,
            new PatternTopic(channel));
        log.info("Subscribed to Redis channel: {}", channel);
    }

    @Override
    public void onMessage(Message message, byte[] pattern) {
        try {
            String payload = new String(message.getBody());
            log.info("Progress update: {}", payload);
            messagingTemplate.convertAndSend("/topic/progress", payload);
        } catch (Exception e) {
            log.error("Error forwarding progress: {}", e.getMessage());
        }
    }
}