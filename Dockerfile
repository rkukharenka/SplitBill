FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app

RUN apk add --no-cache nodejs npm

COPY gradlew .
COPY gradle gradle
RUN chmod +x gradlew

COPY build.gradle.kts settings.gradle.kts gradle.properties ./
RUN ./gradlew dependencies --no-daemon -q 2>/dev/null || true

COPY webapp webapp
RUN cd webapp && npm ci --prefer-offline

COPY src src
RUN ./gradlew bootJar --no-daemon -x test -q

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
