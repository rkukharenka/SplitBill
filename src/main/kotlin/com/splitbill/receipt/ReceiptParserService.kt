package com.splitbill.receipt

import com.anthropic.client.AnthropicClient
import com.anthropic.models.messages.*
import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.databind.ObjectMapper
import com.splitbill.config.ClaudeProperties
import org.springframework.stereotype.Service
import java.math.BigDecimal
import java.util.Base64

@Service
class ReceiptParserService(
    private val client: AnthropicClient,
    private val props: ClaudeProperties,
    private val objectMapper: ObjectMapper
) {
    companion object {
        private const val CONFIDENCE_THRESHOLD = 0.70
        private const val SYSTEM_PROMPT = """Ты — парсер кассовых чеков. Получаешь фото чека и возвращаешь ТОЛЬКО JSON, без markdown, без пояснений.
Формат ответа:
{"items":[{"name":"название","price":123.45,"quantity":1}],"currency":"BYN","confidence":0.95}
Правила:
- currency — ISO 4217 код валюты из чека (RUB, USD, EUR, GEL, KZT и т.д.)
- price — итоговая цена за позицию (уже умноженная на quantity, если quantity > 1)
- confidence — от 0.0 до 1.0, отражает качество распознавания
- Если не можешь распознать чек — верни {"items":[],"currency":"BYN","confidence":0.0}"""
    }

    fun parse(imageBytes: ByteArray, mimeType: String): ReceiptResult {
        val result = callClaude(imageBytes, mimeType, props.haikuModel)
        return if (result.confidence >= CONFIDENCE_THRESHOLD) result
        else callClaude(imageBytes, mimeType, props.sonnetModel)
    }

    private fun callClaude(imageBytes: ByteArray, mimeType: String, model: String): ReceiptResult {
        val base64Data = Base64.getEncoder().encodeToString(imageBytes)
        val mediaType = Base64ImageSource.MediaType.of(mimeType)

        val imageParam = ImageBlockParam.builder()
            .source(
                Base64ImageSource.builder()
                    .data(base64Data)
                    .mediaType(mediaType)
                    .build()
            )
            .build()

        val textParam = TextBlockParam.builder()
            .text("Распознай позиции из этого чека.")
            .build()

        val params = MessageCreateParams.builder()
            .model(model)
            .maxTokens(2048L)
            .system(SYSTEM_PROMPT)
            .addUserMessageOfBlockParams(
                listOf(
                    ContentBlockParam.ofImage(imageParam),
                    ContentBlockParam.ofText(textParam)
                )
            )
            .build()

        val message = client.messages().create(params)
        val text = message.content()
            .stream()
            .flatMap { it.text().stream() }
            .findFirst()
            .orElseThrow { IllegalStateException("Empty Claude response") }
            .text()

        return parseJson(text)
    }

    private fun parseJson(raw: String): ReceiptResult {
        return try {
            val cleaned = raw.trim()
                .removePrefix("```json").removePrefix("```")
                .removeSuffix("```")
                .trim()
            val dto = objectMapper.readValue(cleaned, ReceiptResultDto::class.java)
            ReceiptResult(
                items = dto.items.map { ReceiptItem(it.name, BigDecimal.valueOf(it.price), it.quantity) },
                currency = dto.currency.uppercase(),
                confidence = dto.confidence
            )
        } catch (_: Exception) {
            ReceiptResult(items = emptyList(), currency = "BYN", confidence = 0.0)
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private data class ReceiptResultDto(
        val items: List<ItemDto> = emptyList(),
        val currency: String = "BYN",
        val confidence: Double = 0.0
    )

    @JsonIgnoreProperties(ignoreUnknown = true)
    private data class ItemDto(
        val name: String = "",
        val price: Double = 0.0,
        val quantity: Int = 1
    )
}
