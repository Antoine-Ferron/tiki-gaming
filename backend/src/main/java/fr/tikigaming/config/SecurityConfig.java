package fr.tikigaming.config;

import fr.tikigaming.auth.GoogleLoginSuccessHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;

@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http, GoogleLoginSuccessHandler googleSuccess, TikiProperties props) throws Exception {
        http
                // L'accès aux données est contrôlé par la RLS Supabase ; les endpoints /api/auth et /api/scores
                // vérifient eux-mêmes la session.
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
                // Le front lit le cookie XSRF-TOKEN et le renvoie dans l'en-tête X-XSRF-TOKEN.
                .csrf(csrf -> csrf.csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                        .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
                .oauth2Login(oauth -> oauth.successHandler(googleSuccess)
                        .failureHandler((req, res, e) -> res.sendRedirect(props.frontendUrl() + "/login?error=google")))
                .requestCache(cache -> cache.disable())
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable);
        return http.build();
    }
}
