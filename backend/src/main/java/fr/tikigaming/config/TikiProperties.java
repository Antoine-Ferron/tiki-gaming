package fr.tikigaming.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("tiki")
public record TikiProperties(String frontendUrl, Supabase supabase) {

    public record Supabase(String url, String anonKey, String serviceRoleKey, String jwtSecret, Duration tokenTtl) {}
}
