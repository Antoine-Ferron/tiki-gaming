# Image de build : compile le jar avec Maven (dépendances mises en cache tant que pom.xml ne change pas).
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -B -ntp dependency:go-offline
COPY checkstyle.xml .
COPY src ./src
RUN mvn -B -ntp -DskipTests package

# Image d'exécution : utilisateur non-root. Jamais exposée directement (voir docker-compose.yml racine).
# JDK complet plutôt que la variante JRE : son image jlink ne contient pas le module jdk.random, requis au
# démarrage par RandomGenerator.getDefault() (MastermindService) via ServiceLoader.
FROM eclipse-temurin:21-jdk-noble
RUN groupadd -r tiki && useradd -r -g tiki tiki
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
USER tiki
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
