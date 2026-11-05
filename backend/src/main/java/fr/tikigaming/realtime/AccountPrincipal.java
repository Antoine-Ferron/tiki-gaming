package fr.tikigaming.realtime;

import java.security.Principal;

/** Identité d'un compte connecté sur une connexion WebSocket, pour les destinations {@code /user/...}. */
public record AccountPrincipal(String accountId) implements Principal {
    @Override
    public String getName() {
        return accountId;
    }
}
