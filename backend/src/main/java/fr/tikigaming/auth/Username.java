package fr.tikigaming.auth;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Pseudo valide : 3 à 24 caractères parmi lettres sans accent, chiffres et _. Aligné sur la contrainte CHECK de
 * public.profiles.username et sur frontend/src/lib/validation.ts.
 */
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = UsernameValidator.class)
public @interface Username {

    String message() default "Ce pseudo n’est pas valide.";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
