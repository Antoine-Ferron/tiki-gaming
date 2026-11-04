package fr.tikigaming.games.sdv_civilisation.api;

import fr.tikigaming.config.TikiProperties;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Optional;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

/**
 * Scelle la partie enregistrée (AES-GCM) : la ligne game_saves est lisible par le joueur (RLS), mais il ne peut ni
 * y lire les mains des IA, ni la modifier sans que le serveur s'en aperçoive. La clé est dérivée du secret
 * serveur ({@code tiki.supabase.jwt-secret}), propre à cet usage.
 */
@Component
public class SealedState {

    private static final Logger log = LoggerFactory.getLogger(SealedState.class);
    private static final String CIPHER = "AES/GCM/NoPadding";
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;

    private final SecretKey key;
    private final ObjectMapper json;
    private final SecureRandom random = new SecureRandom();

    public SealedState(TikiProperties props, ObjectMapper json) {
        this.key = deriveKey(props.supabase().jwtSecret());
        this.json = json;
    }

    public String seal(SavedGame game) {
        byte[] iv = new byte[IV_BYTES];
        random.nextBytes(iv);
        try {
            Cipher cipher = Cipher.getInstance(CIPHER);
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            byte[] sealed = cipher.doFinal(json.writeValueAsBytes(game));
            return Base64.getEncoder()
                    .encodeToString(ByteBuffer.allocate(iv.length + sealed.length)
                            .put(iv)
                            .put(sealed)
                            .array());
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Chiffrement AES-GCM indisponible", e);
        }
    }

    /** La partie scellée, ou vide si le sceau est illisible (modifié, ou venu d'un autre secret). */
    public Optional<SavedGame> unseal(String sealed) {
        try {
            byte[] bytes = Base64.getDecoder().decode(sealed);
            Cipher cipher = Cipher.getInstance(CIPHER);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, bytes, 0, IV_BYTES));
            byte[] plain = cipher.doFinal(bytes, IV_BYTES, bytes.length - IV_BYTES);
            return Optional.of(json.readValue(plain, SavedGame.class));
        } catch (IllegalArgumentException | GeneralSecurityException | JacksonException e) {
            log.warn("Partie enregistrée illisible, ignorée : {}", e.getClass().getSimpleName());
            return Optional.empty();
        }
    }

    private static SecretKey deriveKey(String secret) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(("sdv-civilisation/game_saves:" + secret).getBytes(StandardCharsets.UTF_8));
            return new SecretKeySpec(digest, "AES");
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("SHA-256 indisponible", e);
        }
    }
}
