# syntax=docker/dockerfile:1
# Build: docker build --build-context shared-schema=shared/schema backend
# (docker/docker-compose.yml passes the extra context automatically.)

# --- build ---------------------------------------------------------------
FROM eclipse-temurin:25-jdk-noble AS build
WORKDIR /src/backend
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -q dependency:go-offline
# pom.xml reads the content schema from ../shared/schema (docs/adr/0005).
COPY --from=shared-schema . /src/shared/schema
COPY src src
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -q package -DskipTests \
 && java -Djarmode=tools -jar target/platform.jar extract --layers --launcher --destination /extracted

# --- runtime -------------------------------------------------------------
FROM eclipse-temurin:25-jre-noble
RUN groupadd --system app && useradd --system --gid app --no-create-home app
WORKDIR /app
# Layers ordered from least to most frequently changed, for better image caching.
COPY --from=build /extracted/dependencies/ ./
COPY --from=build /extracted/spring-boot-loader/ ./
COPY --from=build /extracted/snapshot-dependencies/ ./
COPY --from=build /extracted/application/ ./
USER app
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "org.springframework.boot.loader.launch.JarLauncher"]
