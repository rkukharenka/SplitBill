package com.splitbill

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

@SpringBootApplication
@EnableScheduling
class SplitBillApplication

fun main(args: Array<String>) {
    runApplication<SplitBillApplication>(*args)
}
