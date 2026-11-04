package fr.tikigaming.auth;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.util.LinkedHashSet;
import java.util.Set;

/** Vérifie un pseudo et explique précisément ce qui ne va pas (caractère interdit nommé, longueur). */
public class UsernameValidator implements ConstraintValidator<Username, String> {

    static final int MIN_LENGTH = 3;
    static final int MAX_LENGTH = 24;

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        String message = problem(value);
        if (message == null) return true;
        context.disableDefaultConstraintViolation();
        context.buildConstraintViolationWithTemplate(escapeTemplate(message)).addConstraintViolation();
        return false;
    }

    /** Message décrivant le problème du pseudo, ou null s'il est valide. */
    static String problem(String value) {
        if (value == null || value.isBlank()) return "Choisis un pseudo.";
        Set<String> forbidden = new LinkedHashSet<>();
        value.codePoints().filter(c -> !isAllowed(c)).forEach(c -> forbidden.add(describe(c)));
        if (!forbidden.isEmpty()) {
            String label = forbidden.size() == 1 ? "Caractère non autorisé" : "Caractères non autorisés";
            return label + " : " + String.join(", ", forbidden)
                    + " — utilise uniquement des lettres sans accent, des chiffres et _.";
        }
        if (value.length() < MIN_LENGTH) return "Le pseudo doit contenir au moins " + MIN_LENGTH + " caractères.";
        if (value.length() > MAX_LENGTH) return "Le pseudo doit contenir au plus " + MAX_LENGTH + " caractères.";
        return null;
    }

    private static boolean isAllowed(int c) {
        return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_';
    }

    private static String describe(int c) {
        return Character.isWhitespace(c) ? "espace" : Character.toString(c);
    }

    /** Le message est un template Bean Validation : {, }, $ et \ saisis par l'utilisateur doivent rester littéraux. */
    private static String escapeTemplate(String message) {
        return message.replaceAll("([\\\\{}$])", "\\\\$1");
    }
}
