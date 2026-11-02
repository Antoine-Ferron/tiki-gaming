package fr.tikigaming.auth;

import java.io.Serializable;

/** Utilisateur connecté, tel qu'enregistré dans auth.users de Supabase. Stocké en session HTTP. */
public record AuthUser(String id, String email) implements Serializable {}
