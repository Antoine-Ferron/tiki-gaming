package fr.tikigaming.auth;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import fr.tikigaming.config.TikiProperties;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Component;

/**
 * Émet des JWT au format Supabase (signés avec le secret JWT du projet) : le front les passe à
 * supabase-js, et la RLS reconnaît l'utilisateur via auth.uid() = sub.
 */
@Component
public class SupabaseTokenService {

    public record IssuedToken(String value, Instant expiresAt) {}

    private final JwtEncoder encoder;
    private final String issuer;
    private final Duration ttl;

    public SupabaseTokenService(TikiProperties props) {
        TikiProperties.Supabase cfg = props.supabase();
        byte[] secret = cfg.jwtSecret().getBytes(StandardCharsets.UTF_8);
        this.encoder = new NimbusJwtEncoder(new ImmutableSecret<>(new SecretKeySpec(secret, "HmacSHA256")));
        this.issuer = cfg.url() + "/auth/v1";
        this.ttl = cfg.tokenTtl();
    }

    public IssuedToken issue(AuthUser user) {
        Instant now = Instant.now();
        Instant expiresAt = now.plus(ttl);
        JwtClaimsSet claims = JwtClaimsSet.builder()
            .issuer(issuer)
            .subject(user.id())
            .audience(java.util.List.of("authenticated"))
            .claim("role", "authenticated")
            .claim("email", user.email())
            .issuedAt(now)
            .expiresAt(expiresAt)
            .build();
        String token = encoder
            .encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
            .getTokenValue();
        return new IssuedToken(token, expiresAt);
    }
}
