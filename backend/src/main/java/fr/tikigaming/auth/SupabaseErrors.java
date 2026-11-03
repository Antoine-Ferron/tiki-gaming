package fr.tikigaming.auth;

import java.util.Map;

/** Traduit les codes d'erreur de l'API Auth de Supabase (GoTrue) en messages pour le joueur. */
final class SupabaseErrors {

    static final String DEFAULT_MESSAGE = "Erreur du service d'authentification.";

    private static final String RETRY_LATER = "Patiente quelques minutes avant de réessayer.";

    private static final Map<String, String> MESSAGES = Map.ofEntries(
            Map.entry("invalid_credentials", "Email ou mot de passe incorrect."),
            Map.entry("user_already_exists", "Un compte existe déjà avec cette adresse email."),
            Map.entry("email_exists", "Un compte existe déjà avec cette adresse email."),
            Map.entry("email_not_confirmed", "Confirme ton adresse email avant de te connecter (vérifie tes emails)."),
            Map.entry("email_address_invalid", "Cette adresse email n’est pas valide."),
            Map.entry("weak_password", "Ce mot de passe est trop faible : choisis-en un plus long ou plus varié."),
            Map.entry("same_password", "Le nouveau mot de passe doit être différent de l'ancien."),
            Map.entry("signup_disabled", "Les inscriptions sont fermées pour le moment."),
            Map.entry("otp_expired", "Le lien a expiré : demandes-en un nouveau."),
            Map.entry("bad_jwt", "Le lien a expiré : demandes-en un nouveau."),
            Map.entry("session_expired", "Ta session a expiré : reconnecte-toi."),
            Map.entry("over_email_send_rate_limit", "Trop d'emails envoyés. " + RETRY_LATER),
            Map.entry("over_request_rate_limit", "Trop de tentatives. " + RETRY_LATER));

    private SupabaseErrors() {}

    /** Message traduit pour ce code, sinon le message brut de Supabase, sinon un message générique. */
    static String message(String code, String supabaseMessage) {
        if (code != null && MESSAGES.containsKey(code)) return MESSAGES.get(code);
        return supabaseMessage != null && !supabaseMessage.isBlank() ? supabaseMessage : DEFAULT_MESSAGE;
    }
}
