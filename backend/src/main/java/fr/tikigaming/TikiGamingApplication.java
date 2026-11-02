package fr.tikigaming;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class TikiGamingApplication {

    public static void main(String[] args) {
        SpringApplication.run(TikiGamingApplication.class, args);
    }
}
