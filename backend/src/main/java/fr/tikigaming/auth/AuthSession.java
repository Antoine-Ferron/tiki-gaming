package fr.tikigaming.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;

/** Lecture/écriture de l'utilisateur connecté dans la session HTTP. */
public final class AuthSession {

    static final String USER = "tiki.user";
    static final String GOOGLE_REDIRECT = "tiki.google-redirect";

    private AuthSession() {}

    public static AuthUser currentUser(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        return session == null ? null : (AuthUser) session.getAttribute(USER);
    }

    public static void signIn(HttpServletRequest request, AuthUser user) {
        request.getSession(true);
        request.changeSessionId(); // protection contre la fixation de session
        request.getSession().setAttribute(USER, user);
    }

    /** N'accepte que des chemins relatifs à l'application (pas de redirection ouverte). */
    static String safeRedirect(String path) {
        if (path == null || !path.startsWith("/") || path.startsWith("//") || path.contains("\\")) return "/";
        return path;
    }
}
