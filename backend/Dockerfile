# syntax=docker/dockerfile:1
# --- build ---------------------------------------------------------------
FROM eclipse-temurin:25-jdk-noble AS build
WORKDIR /src
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -q dependency:go-offline
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
