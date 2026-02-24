# Schema Inventory (prisma/schema.prisma)

## Generator and Datasource
- generator client: line 2 provider = "prisma-client-js"
- datasource db: line 6 provider = "postgresql"

## Models
### User (lines 9-54)
- Model attributes:
  - line 53 @@map("users")
- Fields:
  - line 10 id String String                    @id @default(uuid())
  - line 11 name String String
  - line 12 email String String                    @unique
  - line 13 passwordHash String? String?
  - line 14 phone String? String?
  - line 15 status String String                    @default("pending")
  - line 16 lastLoginAt DateTime? DateTime?
  - line 17 createdAt DateTime DateTime                  @default(now())
  - line 18 updatedAt DateTime DateTime                  @updatedAt
  - line 19 emailVerificationToken String? ?                   @unique
  - line 20 emailVerified Boolean Boolean                   @default(false)
  - line 21 emailVerifiedAt DateTime? ateTime?
  - line 22 termsAcceptedAt DateTime? ateTime?
  - line 23 avatarUrl String? String?
  - line 24 googleId String? String?                   @unique
  - line 25 authProvider String String                    @default("email")
  - line 26 cpf String? String?
  - line 27 cnpj String? String?
  - line 28 hasCompany Boolean Boolean                   @default(false)
  - line 29 razaoSocial String? String?
  - line 30 passwordUpdatedAt DateTime? eTime?
  - line 31 passwordHistory Json? Json?
  - line 32 defaultPostingUnitId String? ng?
  - line 33 addresses Address[] Address[]
  - line 34 cards Card[] Card[]
  - line 35 carts Cart[] Cart[]
  - line 36 passwordResetTokens PasswordResetToken[] en[]
  - line 37 paymentTransactions PaymentTransaction[] on[]
  - line 38 quotes Quote[] Quote[]
  - line 39 recipients Recipient[] Recipient[]
  - line 40 receivedShipments Shipment[] ment[]                @relation("RecipientShipments")
  - line 41 sentShipments Shipment[] Shipment[]                @relation("SenderShipments")
  - line 42 supportTickets SupportTicket[] tTicket[]
  - line 43 securityEvents UserSecurityEvent[] tyEvent[]
  - line 44 packagingTemplates PackagingTemplate[] ate[]
  - line 45 recurringItems RecurringItem[] ingItem[]
  - line 46 wallet Wallet? Wallet?
  - line 47 pickupRequests PickupRequest[] Request[]
  - line 48 trackingCodeReservations TrackingCodeReservation[]
  - line 49 recipientPaymentRequests RecipientPaymentRequest[]
  - line 50 assistantChatSessions AssistantChatSession[] []

### Address (lines 56-76)
- Model attributes:
  - line 73 @@index([userId])
  - line 74 @@index([cep])
  - line 75 @@map("addresses")
- Fields:
  - line 57 id String String   @id @default(uuid())
  - line 58 cep String String   @db.VarChar(8)
  - line 59 logradouro String g
  - line 60 numero String tring
  - line 61 complemento String?
  - line 62 bairro String tring
  - line 63 cidade String tring
  - line 64 uf String String   @db.VarChar(2)
  - line 65 userId String tring
  - line 66 createdAt DateTime me @default(now())
  - line 67 updatedAt DateTime me @updatedAt
  - line 68 isDefault Boolean an  @default(false)
  - line 69 label String? tring?
  - line 70 user User User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  - line 71 billingCards Card[] @relation("BillingAddress")

### Card (lines 78-100)
- Model attributes:
  - line 96 @@unique([userId, fingerprint])
  - line 97 @@index([userId])
  - line 98 @@index([userId, isDefault])
  - line 99 @@map("cards")
- Fields:
  - line 79 id String String    @id @default(cuid())
  - line 80 userId String String
  - line 81 brand CardBrand CardBrand
  - line 82 holderName String tring
  - line 83 last4 String String    @db.VarChar(4)
  - line 84 expMonth Int Int
  - line 85 expYear Int Int
  - line 86 fingerprint String ring
  - line 87 isDefault Boolean oolean   @default(false)
  - line 88 billingAddressId String?
  - line 89 vaultToken String tring    @unique
  - line 90 panCipher String? tring?
  - line 91 createdAt DateTime teTime  @default(now())
  - line 92 updatedAt DateTime teTime  @updatedAt
  - line 93 billingAddress Address? ?  @relation("BillingAddress", fields: [billingAddressId], references: [id])
  - line 94 user User User      @relation(fields: [userId], references: [id], onDelete: Cascade)

### Recipient (lines 102-129)
- Model attributes:
  - line 124 @@index([userId, isDefault])
  - line 125 @@index([userId, document])
  - line 126 @@index([userId, name])
  - line 127 @@index([userId, nameSearch])
  - line 128 @@map("recipients")
- Fields:
  - line 103 id String String   @id @default(cuid())
  - line 104 userId String ring
  - line 105 name String String
  - line 106 nameSearch String
  - line 107 email String? ring?  @db.VarChar(160)
  - line 108 document String? g?  @db.VarChar(14)
  - line 109 phone String? ring?  @db.VarChar(20)
  - line 110 notes String? ring?  @db.VarChar(280)
  - line 111 isDefault Boolean n  @default(false)
  - line 112 cep String String   @db.VarChar(8)
  - line 113 logradouro String
  - line 114 numero String ring   @db.VarChar(20)
  - line 115 complemento String?
  - line 116 bairro String ring
  - line 117 cidade String ring
  - line 118 uf String String   @db.VarChar(2)
  - line 119 createdAt DateTime e @default(now())
  - line 120 updatedAt DateTime e @updatedAt
  - line 121 user User User     @relation(fields: [userId], references: [id], onDelete: Cascade)

### Cart (lines 131-144)
- Model attributes:
  - line 142 @@index([userId, status])
  - line 143 @@map("carts")
- Fields:
  - line 132 id String String     @id @default(cuid())
  - line 133 userId String ng
  - line 134 status String ng     @default("OPEN")
  - line 135 totals Json? n?
  - line 136 meta Json? son?
  - line 137 createdAt DateTime @default(now())
  - line 138 updatedAt DateTime @updatedAt
  - line 139 items CartItem[] m[]
  - line 140 user User User       @relation(fields: [userId], references: [id], onDelete: Cascade)

### CartItem (lines 146-165)
- Model attributes:
  - line 163 @@index([cartId])
  - line 164 @@map("cart_items")
- Fields:
  - line 147 id String String   @id @default(cuid())
  - line 148 cartId String String
  - line 149 originAddress Json
  - line 150 destination Json on
  - line 151 volumes Json Json
  - line 152 preferences Json on
  - line 153 insuranceValue Decimal?
  - line 154 pickupPoint Json? n?
  - line 155 pickupFee Json? son?
  - line 156 selectedQuote Json
  - line 157 totals Json Json
  - line 158 document Json? Json?
  - line 159 createdAt DateTime Time @default(now())
  - line 160 updatedAt DateTime Time @updatedAt
  - line 161 cart Cart Cart     @relation(fields: [cartId], references: [id], onDelete: Cascade)

### Shipment (lines 167-223)
- Model attributes:
  - line 213 @@index([platformTrackingCode])
  - line 214 @@index([carrierTrackingCode])
  - line 215 @@index([senderId])
  - line 216 @@index([recipientId])
  - line 217 @@index([status])
  - line 218 @@index([publicTrackingId])
  - line 219 @@index([senderId, status])
  - line 220 @@index([createdAt])
  - line 221 @@index([senderId, status, createdAt])
  - line 222 @@map("shipments")
- Fields:
  - line 168 id String String                   @id @default(uuid())
  - line 169 platformTrackingCode String String                   @unique
  - line 170 carrierTrackingCode String? String?
  - line 171 carrierMetadata Json? Json?
  - line 172 senderId String String
  - line 173 recipientId String? String?
  - line 174 recipientName String? String?
  - line 175 recipientPhone String? String?
  - line 176 recipientEmail String? String?
  - line 177 recipientDocument String? String?
  - line 178 destinationAddress String? String?
  - line 179 destinationNeighborhood String? String?
  - line 180 destinationCity String String
  - line 181 destinationState String String
  - line 182 weight Float Float
  - line 183 declaredValue Float Float
  - line 184 status String String                   @default("PICKUP_REQUESTED")
  - line 185 carrier String? String?
  - line 186 service String? String?
  - line 187 originCep String String
  - line 188 destinationCep String String
  - line 189 estimatedDays Int? Int?
  - line 190 freightCost Float? Float?
  - line 191 pickupFee Float? Float?
  - line 192 pickupPointId String? String?
  - line 193 document Json? Json?
  - line 194 paymentMethod String? String?
  - line 195 publicTrackingId String? String?                  @unique @default(cuid())
  - line 196 postedAt DateTime? DateTime?
  - line 197 receivedAt DateTime? DateTime?
  - line 198 receivedBy String? String?
  - line 199 deliveredAt DateTime? DateTime?
  - line 200 createdAt DateTime DateTime                 @default(now())
  - line 201 updatedAt DateTime DateTime                 @updatedAt
  - line 203 platformShippingCommissionCents Int? @map("platform_shipping_commission_cents")
  - line 204 platformPickupCommissionCents Int? ?                     @map("platform_pickup_commission_cents")
  - line 205 recipient User? User?                    @relation("RecipientShipments", fields: [recipientId], references: [id])
  - line 206 sender User User                     @relation("SenderShipments", fields: [senderId], references: [id])
  - line 207 trackingEvents TrackingEvent[] TrackingEvent[]
  - line 208 label Label? Label?
  - line 209 pickupRequest PickupRequest? PickupRequest?
  - line 210 packages Package[] Package[]
  - line 211 recipientPaymentRequest RecipientPaymentRequest? equest?

### Label (lines 225-252)
- Model attributes:
  - line 246 @@index([status])
  - line 247 @@index([isPrinted])
  - line 248 @@index([createdAt])
  - line 249 @@index([status, isPrinted])
  - line 250 @@index([trackingCode])
  - line 251 @@map("labels")
- Fields:
  - line 226 id String String    @id @default(uuid())
  - line 227 shipmentId String ng    @unique
  - line 228 carrier String tring
  - line 229 service String tring
  - line 230 status String String    @default("pending")
  - line 231 priceCents Int nt
  - line 232 currency String ring    @default("BRL")
  - line 233 trackingCode String?
  - line 234 recipientName String?
  - line 235 fileUrl String? ring?
  - line 236 fileBase64 String? g?   @db.Text
  - line 237 contentType String? ?   @default("application/pdf")
  - line 238 sizeBytes Int? nt?
  - line 239 isPrinted Boolean ean   @default(false)
  - line 240 printedAt DateTime? me?
  - line 241 createdAt DateTime ime  @default(now())
  - line 242 updatedAt DateTime ime  @updatedAt
  - line 243 shipment Shipment ment  @relation(fields: [shipmentId], references: [id], onDelete: Cascade)

### Package (lines 254-288)
- Model attributes:
  - line 282 @@unique([shipmentId, packageNumber])
  - line 283 @@index([shipmentId])
  - line 284 @@index([hasDivergence])
  - line 285 @@index([checkedAt])
  - line 286 @@index([carrierTrackingCode])
  - line 287 @@map("packages")
- Fields:
  - line 255 id String String    @id @default(uuid())
  - line 256 shipmentId String String
  - line 257 packageNumber Int Int
  - line 258 width Float Float
  - line 259 height Float Float
  - line 260 length Float Float
  - line 261 weight Float Float
  - line 263 carrierTrackingCode String? g?
  - line 264 carrierPrePostageId String? g?
  - line 265 carrierQuotePrice Float? oat?
  - line 266 hasDivergence Boolean Boolean   @default(false)
  - line 267 divergenceType String? String?
  - line 268 divergenceNotes String? tring?   @db.Text
  - line 269 divergenceWidth Float? Float?
  - line 270 divergenceHeight Float? loat?
  - line 271 divergenceLength Float? loat?
  - line 272 divergenceWeight Float? loat?
  - line 273 divergencePhotoUrl String? ng?
  - line 274 divergenceRegisteredAt DateTime?
  - line 275 divergenceRegisteredBy String?
  - line 276 checkedAt DateTime? DateTime?
  - line 277 checkedBy String? String?
  - line 278 createdAt DateTime DateTime  @default(now())
  - line 279 updatedAt DateTime DateTime  @updatedAt
  - line 280 shipment Shipment Shipment  @relation(fields: [shipmentId], references: [id], onDelete: Cascade)

### PickupRequest (lines 290-327)
- Model attributes:
  - line 319 @@index([status])
  - line 320 @@index([createdAt])
  - line 321 @@index([originCep])
  - line 322 @@index([scheduleAt])
  - line 323 @@index([userId, status, createdAt])
  - line 324 @@index([collectorId, status])
  - line 325 @@index([collectorId, collectedAt])
  - line 326 @@map("pickup_requests")
- Fields:
  - line 291 id String String     @id @default(cuid())
  - line 292 userId String String
  - line 293 collectorId String? String?
  - line 294 shipmentId String String     @unique
  - line 295 originCep String String
  - line 296 originAddress String? tring?
  - line 297 originCity String? String?
  - line 298 originUf String? String?    @db.VarChar(2)
  - line 299 windowStart DateTime? ateTime?
  - line 300 windowEnd DateTime? DateTime?
  - line 301 status String String     @default("PENDING")
  - line 302 notes String? String?    @db.Text
  - line 303 collectedAt DateTime? ateTime?
  - line 304 collectedBy String? String?
  - line 305 scannedCode String? String?
  - line 306 deliveredToCarrierAt DateTime?
  - line 307 carrierRecipient String? ng?
  - line 308 carrierUnit String? String?
  - line 309 scheduleAt DateTime? DateTime?
  - line 310 attemptCount Int Int        @default(0)
  - line 311 attemptNotes Json? Json?
  - line 312 createdAt DateTime DateTime   @default(now())
  - line 313 updatedAt DateTime DateTime   @updatedAt
  - line 314 user User User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  - line 315 collector Collector? Collector? @relation(fields: [collectorId], references: [id], onDelete: SetNull)
  - line 316 shipment Shipment Shipment   @relation(fields: [shipmentId], references: [id], onDelete: Cascade)

### TrackingEvent (lines 329-342)
- Model attributes:
  - line 340 @@index([shipmentId, occurredAt])
  - line 341 @@map("tracking_events")
- Fields:
  - line 330 id String String   @id @default(uuid())
  - line 331 shipmentId String
  - line 332 type String String
  - line 333 description String
  - line 334 city String? tring?
  - line 335 uf String? String?  @db.VarChar(2)
  - line 336 occurredAt DateTime @default(now())
  - line 337 createdAt DateTime e @default(now())
  - line 338 shipment Shipment nt @relation(fields: [shipmentId], references: [id], onDelete: Cascade)

### StaffRole (lines 344-351)
- Model attributes:
  - line 350 @@map("staff_roles")
- Fields:
  - line 345 id String String      @id @default(cuid())
  - line 346 name String ring      @unique
  - line 347 createdAt DateTime @default(now())
  - line 348 users StaffUser[] r[]

### StaffUser (lines 353-372)
- Model attributes:
  - line 370 @@index([email])
  - line 371 @@map("staff_users")
- Fields:
  - line 354 id String String            @id @default(cuid())
  - line 355 name String String
  - line 356 email String String            @unique
  - line 357 passwordHash String @map("passwordHash")
  - line 358 status StaffStatus tatus       @default(ACTIVE)
  - line 359 roleId String tring            @map("roleId")
  - line 360 lastLoginAt DateTime? @map("lastLoginAt")
  - line 361 createdAt DateTime me          @default(now()) @map("createdAt")
  - line 362 updatedAt DateTime me          @updatedAt @map("updatedAt")
  - line 363 lastAccessAt DateTime? @map("lastAccessAt")
  - line 364 phone String? tring?
  - line 365 isSuperAdmin Boolean @default(false)
  - line 366 permissions AdminPermission[] @default([])
  - line 367 auditLogs StaffAuditLog[] []
  - line 368 role StaffRole affRole         @relation(fields: [roleId], references: [id])

### StaffAuditLog (lines 374-388)
- Model attributes:
  - line 384 @@index([actorId])
  - line 385 @@index([entity, entityId])
  - line 386 @@index([createdAt])
  - line 387 @@map("staff_audit_logs")
- Fields:
  - line 375 id String String     @id @default(cuid())
  - line 376 actorId String? ?
  - line 377 action String ng
  - line 378 entity String ng
  - line 379 entityId String?
  - line 380 data Json? son?
  - line 381 createdAt DateTime @default(now())
  - line 382 actor StaffUser? er? @relation(fields: [actorId], references: [id])

### UserSecurityEvent (lines 390-404)
- Model attributes:
  - line 400 @@index([userId])
  - line 401 @@index([userId, type])
  - line 402 @@index([createdAt])
  - line 403 @@map("user_security_events")
- Fields:
  - line 391 id String String   @id @default(cuid())
  - line 392 userId String ng
  - line 393 type String ring
  - line 394 ip String? tring?
  - line 395 userAgent String?
  - line 396 metadata Json?
  - line 397 createdAt DateTime @default(now())
  - line 398 user User User     @relation(fields: [userId], references: [id], onDelete: Cascade)

### PasswordResetToken (lines 406-419)
- Model attributes:
  - line 415 @@index([userId])
  - line 416 @@index([expiresAt])
  - line 418 @@map("password_reset_tokens")
- Fields:
  - line 407 id String String    @id @default(cuid())
  - line 408 userId String ng
  - line 409 tokenHash String @unique
  - line 410 expiresAt DateTime
  - line 411 usedAt DateTime? e?
  - line 412 createdAt DateTime @default(now())
  - line 413 user User User      @relation(fields: [userId], references: [id], onDelete: Cascade)

### Wallet (lines 421-433)
- Model attributes:
  - line 432 @@map("wallets")
- Fields:
  - line 422 id String String              @id @default(cuid())
  - line 423 userId String String              @unique
  - line 424 availableCents Int @default(0)
  - line 425 pendingCents Int t                 @default(0)
  - line 426 createdAt DateTime Time            @default(now())
  - line 427 updatedAt DateTime Time            @updatedAt
  - line 428 transactions WalletTransaction[] ]
  - line 429 user User User                @relation(fields: [userId], references: [id], onDelete: Cascade)

### WalletTransaction (lines 435-452)
- Model attributes:
  - line 448 @@index([walletId, status, createdAt])
  - line 449 @@index([referenceId])
  - line 450 @@index([status, confirmedAt])
  - line 451 @@map("wallet_transactions")
- Fields:
  - line 436 id String String         @id @default(cuid())
  - line 437 walletId String ng
  - line 438 type WalletTxType TxType
  - line 439 status WalletTxStatus atus @default(PENDING)
  - line 440 amountCents Int
  - line 441 title String? ring?
  - line 442 referenceId String? @unique
  - line 443 meta Json? Json?
  - line 444 createdAt DateTime e       @default(now())
  - line 445 confirmedAt DateTime?
  - line 446 wallet Wallet llet         @relation(fields: [walletId], references: [id], onDelete: Cascade)

### SupportTicket (lines 454-480)
- Model attributes:
  - line 473 @@index([status, priority, createdAt])
  - line 474 @@index([userId, createdAt])
  - line 475 @@index([pickupPointId, createdAt])
  - line 476 @@index([collectorId, createdAt])
  - line 477 @@index([assignedTo])
  - line 478 @@index([lastActivityAt])
  - line 479 @@map("support_tickets")
- Fields:
  - line 455 id String String              @id @default(cuid())
  - line 456 userId String? String?
  - line 457 subject String String
  - line 458 description String ng
  - line 459 status SupportTicketStatus tStatus @default(OPEN)
  - line 460 priority SupportPriority ority     @default(MEDIUM)
  - line 461 assignedTo String? ng?
  - line 462 createdAt DateTime Time            @default(now())
  - line 463 updatedAt DateTime Time            @updatedAt
  - line 464 lastActivityAt DateTime @default(now())
  - line 465 tags Json? Json?
  - line 466 pickupPointId String?
  - line 467 collectorId String? g?
  - line 468 messages SupportMessage[] age[]
  - line 469 pickupPoint PickupPoint? t?        @relation(fields: [pickupPointId], references: [id], onDelete: Cascade)
  - line 470 user User? User?               @relation(fields: [userId], references: [id], onDelete: Cascade)
  - line 471 collector Collector? tor?          @relation(fields: [collectorId], references: [id], onDelete: Cascade)

### SupportMessage (lines 482-495)
- Model attributes:
  - line 493 @@index([ticketId, createdAt])
  - line 494 @@map("support_messages")
- Fields:
  - line 483 id String String              @id @default(cuid())
  - line 484 ticketId String ng
  - line 485 authorId String ng
  - line 486 authorRole SupportAuthorRole
  - line 487 body String String
  - line 488 isInternal Boolean @default(false)
  - line 489 createdAt DateTime e            @default(now())
  - line 490 attachments SupportAttachment[]
  - line 491 ticket SupportTicket cket       @relation(fields: [ticketId], references: [id], onDelete: Cascade)

### SupportAttachment (lines 497-508)
- Model attributes:
  - line 506 @@index([messageId])
  - line 507 @@map("support_attachments")
- Fields:
  - line 498 id String String         @id @default(cuid())
  - line 499 messageId String
  - line 500 filename String
  - line 501 url String tring
  - line 502 size Int? Int?
  - line 503 createdAt DateTime @default(now())
  - line 504 message SupportMessage e @relation(fields: [messageId], references: [id], onDelete: Cascade)

### PickupPoint (lines 510-543)
- Model attributes:
  - line 539 @@index([status])
  - line 540 @@index([uf, cidade])
  - line 541 @@index([cnpj])
  - line 542 @@map("pickup_points")
- Fields:
  - line 511 id String String            @id @default(cuid())
  - line 512 status PickupPointStatus ointStatus @default(ACTIVE)
  - line 513 razaoSocial String tring
  - line 514 nomeFantasia String ring
  - line 515 cnpj String String            @unique
  - line 516 ie String? String?
  - line 517 email String? String?
  - line 518 telefone String? String?
  - line 519 cep String? String?
  - line 520 logradouro String? tring?
  - line 521 numero String? String?
  - line 522 complemento String? ring?
  - line 523 bairro String? String?
  - line 524 cidade String? String?
  - line 525 uf String? String?           @db.VarChar(2)
  - line 527 paymentMethod Json son
  - line 528 payoutDay Int? Int?
  - line 529 minPayoutAmount Decimal? ?          @db.Decimal(10, 2)
  - line 530 commissionPerItem Decimal? @db.Decimal(10, 2)
  - line 531 capacityPerDay Int? t?
  - line 532 monthlyReceived Int t               @default(0)
  - line 533 createdAt DateTime ateTime          @default(now())
  - line 534 updatedAt DateTime ateTime          @updatedAt
  - line 535 passwordHash String? ing?
  - line 536 receptions Reception[] tion[]
  - line 537 supportTickets SupportTicket[] []

### Reception (lines 545-570)
- Model attributes:
  - line 565 @@index([pickupPointId, status])
  - line 566 @@index([pickupPointId, receivedAt])
  - line 568 @@index([status])
  - line 569 @@map("receptions")
- Fields:
  - line 546 id String String          @id @default(cuid())
  - line 547 pickupPointId String g
  - line 548 trackingCode String ng          @unique
  - line 549 senderName String ring
  - line 550 recipientName String g
  - line 551 weight Float? Float?
  - line 552 declaredValue Float? ?
  - line 553 status ReceptionStatus onStatus @default(PENDING)
  - line 554 expectedAt DateTime? ime?
  - line 555 receivedAt DateTime? ime?
  - line 556 processedAt DateTime? me?
  - line 557 issueType String? ring?
  - line 558 issueDetails String? g?
  - line 559 issuePhotos Json? on?
  - line 560 commissionCents Int @default(0)
  - line 561 createdAt DateTime eTime        @default(now())
  - line 562 updatedAt DateTime eTime        @updatedAt
  - line 563 pickupPoint PickupPoint int     @relation(fields: [pickupPointId], references: [id], onDelete: Cascade)

### Quote (lines 572-596)
- Model attributes:
  - line 592 @@index([userId, status, createdAt])
  - line 593 @@index([userId, createdAt])
  - line 594 @@index([status, expiresAt])
  - line 595 @@map("quotes")
- Fields:
  - line 573 id String String          @id @default(cuid())
  - line 574 userId String tring
  - line 575 status QuoteStatus tatus     @default(DRAFT)
  - line 576 originCep String ng          @db.VarChar(8)
  - line 577 destCep String ring          @db.VarChar(8)
  - line 578 documentType DocumentType
  - line 579 nfeNumber String? g?
  - line 580 nfeValue Decimal? al?        @db.Decimal(10, 2)
  - line 581 isReverse Boolean an         @default(false)
  - line 582 createdAt DateTime me        @default(now())
  - line 583 updatedAt DateTime me        @updatedAt
  - line 584 expiresAt DateTime me
  - line 585 selectedAt DateTime? ?
  - line 586 confirmedAt DateTime?
  - line 587 options QuoteOption[] on[]
  - line 588 selection QuoteSelection? n?
  - line 589 volumes QuoteVolume[] me[]
  - line 590 user User User            @relation(fields: [userId], references: [id], onDelete: Cascade)

### QuoteVolume (lines 598-610)
- Model attributes:
  - line 608 @@index([quoteId])
  - line 609 @@map("quote_volumes")
- Fields:
  - line 599 id String String  @id @default(cuid())
  - line 600 quoteId String ing
  - line 601 height Int Int
  - line 602 width Int Int
  - line 603 length Int Int
  - line 604 weight Decimal imal @db.Decimal(6, 2)
  - line 605 cubicWeight Decimal @db.Decimal(6, 2)
  - line 606 quote Quote Quote   @relation(fields: [quoteId], references: [id], onDelete: Cascade)

### QuoteOption (lines 612-632)
- Model attributes:
  - line 629 @@index([quoteId])
  - line 630 @@index([quoteId, totalCents])
  - line 631 @@map("quote_options")
- Fields:
  - line 613 id String String   @id @default(cuid())
  - line 614 quoteId String String
  - line 615 carrierId String tring
  - line 616 carrierName String ing
  - line 617 serviceId String tring
  - line 618 serviceName String ing
  - line 619 basePriceCents Int
  - line 620 insuranceCents Int @default(0)
  - line 621 additionalCents Int @default(0)
  - line 622 discountCents Int t      @default(0)
  - line 623 totalCents Int Int
  - line 624 deliveryDays Int nt
  - line 625 metadata Json? Json?
  - line 626 createdAt DateTime eTime @default(now())
  - line 627 quote Quote Quote    @relation(fields: [quoteId], references: [id], onDelete: Cascade)

### QuoteSelection (lines 634-647)
- Model attributes:
  - line 645 @@index([quoteId])
  - line 646 @@map("quote_selections")
- Fields:
  - line 635 id String String   @id @default(cuid())
  - line 636 quoteId String ring   @unique
  - line 637 optionId String ing
  - line 638 carrierName String
  - line 639 serviceName String
  - line 640 totalCents Int t
  - line 641 deliveryDays Int
  - line 642 selectedAt DateTime e @default(now())
  - line 643 quote Quote Quote    @relation(fields: [quoteId], references: [id], onDelete: Cascade)

### Carrier (lines 649-669)
- Model attributes:
  - line 666 @@index([slug])
  - line 667 @@index([status])
  - line 668 @@map("carriers")
- Fields:
  - line 650 id String String                 @id @default(cuid())
  - line 651 name String String
  - line 652 slug String String                 @unique
  - line 653 status IntegrationStatus IntegrationStatus      @default(ACTIVE)
  - line 654 environment IntegrationEnvironment onEnvironment @default(PRODUCTION)
  - line 655 baseUrl String? String?
  - line 656 timeout Int Int                    @default(30000)
  - line 657 maxRetries Int Int                    @default(3)
  - line 658 logoUrl String? String?
  - line 659 description String? String?
  - line 661 shippingCommissionPercent Decimal? @map("shipping_commission_percent") @db.Decimal(5, 2)
  - line 662 createdAt DateTime DateTime               @default(now())
  - line 663 updatedAt DateTime DateTime               @updatedAt
  - line 664 credentials CarrierCredential[] rCredential[]

### CarrierCredential (lines 671-696)
- Model attributes:
  - line 694 @@index([carrierId, environment, isActive])
  - line 695 @@map("carrier_credentials")
- Fields:
  - line 672 id String String                 @id @default(cuid())
  - line 673 carrierId String ing
  - line 674 environment IntegrationEnvironment t
  - line 675 authType AuthType Type
  - line 676 apiKey String? tring?
  - line 677 clientId String? ing?
  - line 678 clientSecret String?
  - line 679 username String? ing?
  - line 680 password String? ing?
  - line 681 token String? String?
  - line 682 tokenUrl String? ing?
  - line 683 scope String? String?
  - line 684 accessToken String? ?
  - line 685 refreshToken String?
  - line 686 expiresAt DateTime? me?
  - line 687 customHeaders Json?
  - line 688 isActive Boolean lean                @default(true)
  - line 689 createdAt DateTime ime               @default(now())
  - line 690 updatedAt DateTime ime               @updatedAt
  - line 691 lastRotatedAt DateTime?
  - line 692 carrier Carrier rrier                @relation(fields: [carrierId], references: [id], onDelete: Cascade)

### PaymentGateway (lines 698-719)
- Model attributes:
  - line 716 @@index([slug])
  - line 717 @@index([status])
  - line 718 @@map("payment_gateways")
- Fields:
  - line 699 id String String                 @id @default(cuid())
  - line 700 name String String
  - line 701 slug String String                 @unique
  - line 702 status IntegrationStatus nStatus      @default(ACTIVE)
  - line 703 environment IntegrationEnvironment nt @default(PRODUCTION)
  - line 704 baseUrl String? tring?
  - line 705 timeout Int Int                    @default(30000)
  - line 706 enabledMethods PaymentMethod[]
  - line 707 logoUrl String? tring?
  - line 708 description String? g?
  - line 709 createdAt DateTime Time               @default(now())
  - line 710 updatedAt DateTime Time               @updatedAt
  - line 711 credentials PaymentCredential[] []
  - line 712 endpoints PaymentEndpoint[] nt[]
  - line 713 transactions PaymentTransaction[] ]
  - line 714 webhooks PaymentWebhook[] ook[]

### PaymentCredential (lines 721-744)
- Model attributes:
  - line 742 @@index([gatewayId, environment, isActive])
  - line 743 @@map("payment_credentials")
- Fields:
  - line 722 id String String                 @id @default(cuid())
  - line 723 gatewayId String ing
  - line 724 environment IntegrationEnvironment t
  - line 725 authType AuthType Type
  - line 726 merchantId String? g?
  - line 727 apiKey String? tring?
  - line 728 publicKey String? ng?
  - line 729 secretKey String? ng?
  - line 730 clientId String? ing?
  - line 731 clientSecret String?
  - line 732 accessToken String? ?
  - line 733 refreshToken String?
  - line 734 applicationId String?
  - line 735 expiresAt DateTime? me?
  - line 736 isActive Boolean lean                @default(true)
  - line 737 createdAt DateTime ime               @default(now())
  - line 738 updatedAt DateTime ime               @updatedAt
  - line 739 lastRotatedAt DateTime?
  - line 740 gateway PaymentGateway teway         @relation(fields: [gatewayId], references: [id], onDelete: Cascade)

### PaymentEndpoint (lines 746-763)
- Model attributes:
  - line 760 @@unique([gatewayId, operation])
  - line 761 @@index([gatewayId])
  - line 762 @@map("payment_endpoints")
- Fields:
  - line 747 id String String         @id @default(cuid())
  - line 748 gatewayId String tring
  - line 749 operation String tring
  - line 750 method String String
  - line 751 path String String
  - line 752 timeout Int? Int?
  - line 753 retryable Boolean olean        @default(true)
  - line 754 requestMapping Json?
  - line 755 responseMapping Json?
  - line 756 createdAt DateTime eTime       @default(now())
  - line 757 updatedAt DateTime eTime       @updatedAt
  - line 758 gateway PaymentGateway Gateway @relation(fields: [gatewayId], references: [id], onDelete: Cascade)

### PaymentTransaction (lines 765-796)
- Model attributes:
  - line 790 @@index([gatewayId, status, createdAt])
  - line 791 @@index([userId, status])
  - line 792 @@index([referenceId])
  - line 793 @@index([externalId])
  - line 794 @@index([paidAt])
  - line 795 @@map("payment_transactions")
- Fields:
  - line 766 id String String            @id @default(cuid())
  - line 767 gatewayId String ing
  - line 768 externalId String? g?
  - line 769 referenceId String g            @unique
  - line 770 userId String? tring?
  - line 771 method PaymentMethod Method
  - line 772 status TransactionStatus Status @default(PENDING)
  - line 773 amountCents Int t
  - line 774 feeCents Int Int               @default(0)
  - line 775 netCents Int Int
  - line 776 cardBrand String? ng?
  - line 777 cardLast4 String? ng?
  - line 778 pixKey String? tring?
  - line 779 pixQrCode String? ng?
  - line 780 boletoUrl String? ng?
  - line 781 boletoBarcode String?
  - line 782 metadata Json? son?
  - line 783 createdAt DateTime ime          @default(now())
  - line 784 updatedAt DateTime ime          @updatedAt
  - line 785 authorizedAt DateTime?
  - line 786 paidAt DateTime? eTime?
  - line 787 gateway PaymentGateway teway    @relation(fields: [gatewayId], references: [id])
  - line 788 user User? User?             @relation(fields: [userId], references: [id])

### PaymentWebhook (lines 798-821)
- Model attributes:
  - line 816 @@unique([gatewayId, externalId])
  - line 817 @@index([gatewayId, status, nextRetryAt])
  - line 818 @@index([externalId])
  - line 819 @@index([createdAt])
  - line 820 @@map("payment_webhooks")
- Fields:
  - line 799 id String String         @id @default(cuid())
  - line 800 gatewayId String ng
  - line 801 eventType String ng
  - line 802 externalId String? ?
  - line 803 payload Json Json
  - line 804 signature String? g?
  - line 805 status String tring
  - line 806 processedAt DateTime?
  - line 807 errorMessage String?
  - line 808 retryCount Int t            @default(0)
  - line 809 maxRetries Int t            @default(5)
  - line 810 nextRetryAt DateTime?
  - line 811 createdAt DateTime me       @default(now())
  - line 812 updatedAt DateTime me       @updatedAt
  - line 813 gateway PaymentGateway eway @relation(fields: [gatewayId], references: [id], onDelete: Cascade)

### LedgerEntry (lines 823-836)
- Model attributes:
  - line 833 @@index([accountType, accountId, createdAt])
  - line 834 @@index([type, createdAt])
  - line 835 @@map("ledger_entries")
- Fields:
  - line 824 id String String          @id @default(cuid())
  - line 825 type LedgerEntryType ryType
  - line 826 amountCents Int
  - line 827 accountType String
  - line 828 accountId String? ?
  - line 829 description String
  - line 830 metadata Json? n?
  - line 831 createdAt DateTime e        @default(now())

### EmailConfig (lines 838-852)
- Model attributes:
  - line 851 @@map("email_configs")
- Fields:
  - line 839 id String String            @id @default(cuid())
  - line 840 host String String
  - line 841 port Int Int               @default(587)
  - line 842 secure Boolean lean           @default(false)
  - line 843 user String String
  - line 844 password String ng
  - line 845 fromAddress String
  - line 846 fromName String ng
  - line 847 status EmailConfigStatus atus @default(ACTIVE)
  - line 848 createdAt DateTime e          @default(now())
  - line 849 updatedAt DateTime e          @updatedAt

### GoogleOAuthConfig (lines 854-863)
- Model attributes:
  - line 862 @@map("google_oauth_configs")
- Fields:
  - line 855 id String String   @id @default(cuid())
  - line 856 clientId String ing
  - line 857 clientSecret String
  - line 858 isActive Boolean ean  @default(true)
  - line 859 createdAt DateTime me @default(now())
  - line 860 updatedAt DateTime me @updatedAt

### Collector (lines 865-933)
- Model attributes:
  - line 925 @@index([status])
  - line 926 @@index([pfCpf])
  - line 927 @@index([pfEmail])
  - line 928 @@index([pjCnpj])
  - line 929 @@index([pfCidade, pfUf])
  - line 930 @@index([pjCidade, pjUf])
  - line 931 @@index([googleId])
  - line 932 @@map("collectors")
- Fields:
  - line 866 id String String               @id @default(cuid())
  - line 867 status CollectorStatus CollectorStatus      @default(ACTIVE)
  - line 868 pfNome String String
  - line 869 pfCnhNumber String String
  - line 870 pfCnhCategory String String
  - line 871 pfCnhExpires DateTime DateTime
  - line 872 pfCelular String String
  - line 873 pfWhatsapp String? String?
  - line 874 pfCep String? String?
  - line 875 pfLogradouro String? String?
  - line 876 pfNumero String? String?
  - line 877 pfComplemento String? String?
  - line 878 pfBairro String? String?
  - line 879 pfCidade String? String?
  - line 880 pfUf String? String?              @db.VarChar(2)
  - line 882 pjRazaoSocial String String
  - line 883 pjCnpj String String               @unique
  - line 884 pjCep String? String?
  - line 885 pjLogradouro String? String?
  - line 886 pjNumero String? String?
  - line 887 pjComplemento String? String?
  - line 888 pjBairro String? String?
  - line 889 pjCidade String? String?
  - line 890 pjUf String? String?              @db.VarChar(2)
  - line 892 vehiclePlate String String
  - line 893 vehicleBrand String String
  - line 894 vehicleModel String? String?
  - line 895 vehicleYear String? String?
  - line 896 commissionKind CommissionKind ssionKind
  - line 897 commissionAmount Float? Float?
  - line 898 commissionAmountPerKm Float? t?
  - line 899 pickupFeeType PickupFeeType kupFeeType        @default(FIXED)
  - line 900 pickupFixedFee Float? Float?
  - line 901 pickupFeePerKm Float? Float?
  - line 902 bankMethodKind BankMethodKind ethodKind
  - line 903 bankPixType PixKeyType? PixKeyType?
  - line 904 bankPixKey String? String?
  - line 905 bankCode String? String?
  - line 906 bankBranch String? String?
  - line 907 bankAccount String? String?
  - line 908 bankAccountType AccountType? untType?
  - line 909 bankHolderName String? String?
  - line 910 bankHolderCnpj String? String?
  - line 911 createdAt DateTime DateTime             @default(now())
  - line 912 updatedAt DateTime DateTime             @updatedAt
  - line 913 pfCpf String? String?              @unique
  - line 914 pfEmail String? String?              @unique
  - line 915 pfEmailVerificationToken String? @unique
  - line 916 pfEmailVerified Boolean Boolean              @default(false)
  - line 917 pfEmailVerifiedAt DateTime? eTime?
  - line 918 googleId String? String?              @unique
  - line 919 authProvider String String               @default("email")
  - line 920 credential CollectorCredential? orCredential?
  - line 921 documents CollectorDocument[] ctorDocument[]
  - line 922 pickupRequests PickupRequest[] Request[]
  - line 923 supportTickets SupportTicket[] tTicket[]

### CollectorDocument (lines 935-954)
- Model attributes:
  - line 951 @@unique([collectorId, type])
  - line 952 @@index([collectorId, type])
  - line 953 @@map("collector_documents")
- Fields:
  - line 936 id String String    @id @default(cuid())
  - line 937 collectorId String
  - line 938 type String String
  - line 939 filename String ng
  - line 940 url String? String?
  - line 941 uploadedAt DateTime @default(now())
  - line 942 createdAt DateTime e  @default(now())
  - line 943 expiresAt DateTime? ?
  - line 944 issuedAt DateTime? e?
  - line 945 mimeType String? g?
  - line 946 size Int? Int?
  - line 947 storageKey String?
  - line 948 updatedAt DateTime e  @updatedAt
  - line 949 collector Collector r @relation(fields: [collectorId], references: [id], onDelete: Cascade)

### CollectorCredential (lines 956-965)
- Model attributes:
  - line 964 @@map("collector_credentials")
- Fields:
  - line 957 id String String    @id @default(cuid())
  - line 958 collectorId String @unique
  - line 959 passwordHash String
  - line 960 createdAt DateTime me  @default(now())
  - line 961 updatedAt DateTime me  @updatedAt
  - line 962 collector Collector or @relation(fields: [collectorId], references: [id], onDelete: Cascade)

### PackagingTemplate (lines 967-980)
- Model attributes:
  - line 978 @@index([userId])
  - line 979 @@map("packaging_templates")
- Fields:
  - line 968 id String String   @id @default(cuid())
  - line 969 userId String ng
  - line 970 name String ring
  - line 971 lengthCm Decimal @db.Decimal(10, 2)
  - line 972 widthCm Decimal l  @db.Decimal(10, 2)
  - line 973 heightCm Decimal @db.Decimal(10, 2)
  - line 974 createdAt DateTime @default(now())
  - line 975 updatedAt DateTime @updatedAt
  - line 976 user User User     @relation(fields: [userId], references: [id], onDelete: Cascade)

### CepLocation (lines 1185-1197)
- Model attributes:
  - line 1196 @@map("cep_locations")
- Fields:
  - line 1186 cep String String   @id
  - line 1187 latitude Float Float
  - line 1188 longitude Float Float
  - line 1189 precision String? String?
  - line 1190 provider String? String?
  - line 1191 createdAt DateTime DateTime @default(now()) @map("created_at")
  - line 1192 updatedAt DateTime DateTime @default(now()) @map("updated_at")
  - line 1193 manualOverride Boolean olean  @default(false) @map("manual_override")
  - line 1194 manualOverrideReason String? @map("manual_override_reason")

### CorreiosAgency (lines 1226-1264)
- Model attributes:
  - line 1259 @@index([uf, municipio])
  - line 1260 @@index([cep])
  - line 1261 @@index([status])
  - line 1262 @@index([tipoUnidadeSigla, status])
  - line 1263 @@map("correios_agencies")
- Fields:
  - line 1227 id String String               @id
  - line 1228 nome String String
  - line 1229 status CorreiosAgencyStatus sAgencyStatus @default(ATIVA)
  - line 1230 statusCodigo Int Int                  @default(2) @map("status_codigo")
  - line 1231 statusDescricao String? ing?              @map("status_descricao")
  - line 1232 tipoUnidadeCodigo String ng               @map("tipo_unidade_codigo")
  - line 1233 tipoUnidadeDescricao String? @map("tipo_unidade_descricao")
  - line 1234 tipoUnidadeSigla CorreiosAgencyType ype   @default(OUTROS) @map("tipo_unidade_sigla")
  - line 1237 cep String String  @db.VarChar(8)
  - line 1238 uf String String  @db.VarChar(2)
  - line 1239 municipio String g
  - line 1240 bairro String? ing?
  - line 1241 logradouro String?
  - line 1242 numero String? ing?
  - line 1243 complemento String?
  - line 1246 latitude Float?
  - line 1247 longitude Float?
  - line 1250 horarioFuncionamento String? @map("horario_funcionamento")
  - line 1251 iniExpediente String? tring? @map("ini_expediente")
  - line 1252 fimExpediente String? tring? @map("fim_expediente")
  - line 1255 createdAt DateTime @default(now()) @map("created_at")
  - line 1256 updatedAt DateTime @updatedAt @map("updated_at")
  - line 1257 syncedAt DateTime? @map("synced_at")

### RecurringItem (lines 1266-1278)
- Model attributes:
  - line 1276 @@index([userId])
  - line 1277 @@map("recurring_items")
- Fields:
  - line 1267 id String String   @id @default(uuid())
  - line 1268 userId String String   @map("user_id")
  - line 1269 descricao String ing
  - line 1270 valorUnitario Float @map("valor_unitario")
  - line 1271 createdAt DateTime ime @default(now()) @map("created_at")
  - line 1272 updatedAt DateTime ime @updatedAt @map("updated_at")
  - line 1274 user User @relation(fields: [userId], references: [id], onDelete: Cascade)

### PlatformCommission (lines 1282-1296)
- Model attributes:
  - line 1295 @@map("platform_commissions")
- Fields:
  - line 1283 id String String   @id @default(cuid())
  - line 1285 shippingCommissionPercent Decimal @default(0) @map("shipping_commission_percent") @db.Decimal(5, 2)
  - line 1287 pickupFeeCommissionPercent Decimal @default(0) @map("pickup_fee_commission_percent") @db.Decimal(5, 2)
  - line 1289 isActive Boolean Boolean  @default(true) @map("is_active")
  - line 1291 updatedById String? String?  @map("updated_by_id")
  - line 1292 createdAt DateTime DateTime @default(now()) @map("created_at")
  - line 1293 updatedAt DateTime DateTime @updatedAt @map("updated_at")

### FipeVehicleBrand (lines 1311-1328)
- Model attributes:
  - line 1324 @@unique([vehicleType, fipeCode, referenceCode], name: "fipe_brand_unique")
  - line 1325 @@index([vehicleType, isActive])
  - line 1326 @@index([name])
  - line 1327 @@map("fipe_vehicle_brands")
- Fields:
  - line 1312 id String String          @id @default(cuid())
  - line 1313 vehicleType FipeVehicleType pe @map("vehicle_type")
  - line 1314 fipeCode String tring          @map("fipe_code")
  - line 1315 name String String
  - line 1316 referenceCode Int @map("reference_code")
  - line 1317 referenceMonth String @map("reference_month")
  - line 1318 isActive Boolean olean         @default(true) @map("is_active")
  - line 1319 createdAt DateTime Time        @default(now()) @map("created_at")
  - line 1320 updatedAt DateTime Time        @updatedAt @map("updated_at")
  - line 1322 models FipeVehicleModel[]

### FipeVehicleModel (lines 1331-1350)
- Model attributes:
  - line 1345 @@unique([brandId, fipeCode, referenceCode], name: "fipe_model_unique")
  - line 1346 @@index([brandId, isActive])
  - line 1347 @@index([vehicleType, isActive])
  - line 1348 @@index([name])
  - line 1349 @@map("fipe_vehicle_models")
- Fields:
  - line 1332 id String String          @id @default(cuid())
  - line 1333 brandId String String          @map("brand_id")
  - line 1334 vehicleType FipeVehicleType pe @map("vehicle_type")
  - line 1335 fipeCode String tring          @map("fipe_code")
  - line 1336 name String String
  - line 1337 referenceCode Int @map("reference_code")
  - line 1338 referenceMonth String @map("reference_month")
  - line 1339 isActive Boolean olean         @default(true) @map("is_active")
  - line 1340 createdAt DateTime Time        @default(now()) @map("created_at")
  - line 1341 updatedAt DateTime Time        @updatedAt @map("updated_at")
  - line 1343 brand FipeVehicleBrand @relation(fields: [brandId], references: [id], onDelete: Cascade)

### Expense (lines 1380-1416)
- Model attributes:
  - line 1410 @@index([type, status, createdAt])
  - line 1411 @@index([category, createdAt])
  - line 1412 @@index([dueDate])
  - line 1413 @@index([createdBy])
  - line 1414 @@index([dreAccountCode, createdAt])
  - line 1415 @@map("expenses")
- Fields:
  - line 1381 id String String          @id @default(cuid())
  - line 1382 type ExpenseType seType
  - line 1383 category ExpenseCategory ry
  - line 1384 description String
  - line 1385 amountCents Int @map("amount_cents")
  - line 1386 status ExpenseStatus atus   @default(PENDING)
  - line 1387 dueDate DateTime? me?       @map("due_date")
  - line 1388 paidAt DateTime? ime?       @map("paid_at")
  - line 1389 reference String? ?
  - line 1390 supplier String? g?
  - line 1391 notes String? ring?
  - line 1394 dreAccountCode String? @map("dre_account_code")
  - line 1397 receiptUrl String? tring?   @map("receipt_url")
  - line 1398 receiptFileName String? ?   @map("receipt_file_name")
  - line 1399 receiptUploadedAt DateTime? @map("receipt_uploaded_at")
  - line 1402 isRecurring Boolean ean @default(false) @map("is_recurring")
  - line 1403 recurringMonths Int? @map("recurring_months")
  - line 1406 createdBy String @map("created_by")
  - line 1407 createdAt DateTime @default(now()) @map("created_at")
  - line 1408 updatedAt DateTime @updatedAt @map("updated_at")

### ExpenseTemplate (lines 1419-1436)
- Model attributes:
  - line 1432 @@unique([name, category])
  - line 1433 @@index([category, isActive])
  - line 1434 @@index([isActive, usageCount])
  - line 1435 @@map("expense_templates")
- Fields:
  - line 1420 id String String          @id @default(cuid())
  - line 1421 name String String
  - line 1422 type ExpenseType enseType
  - line 1423 category ExpenseCategory gory
  - line 1424 supplier String? ing?
  - line 1425 defaultAmount Int? @map("default_amount")
  - line 1426 isActive Boolean lean         @default(true) @map("is_active")
  - line 1427 usageCount Int nt             @default(0) @map("usage_count")
  - line 1428 createdBy String ing          @map("created_by")
  - line 1429 createdAt DateTime ime        @default(now()) @map("created_at")
  - line 1430 updatedAt DateTime ime        @updatedAt @map("updated_at")

### FAQItem (lines 1450-1468)
- Model attributes:
  - line 1465 @@index([audience, isActive, sortOrder])
  - line 1466 @@index([category, isActive])
  - line 1467 @@map("faq_items")
- Fields:
  - line 1451 id String String      @id @default(cuid())
  - line 1452 question String g
  - line 1453 answer String ing      @db.Text
  - line 1454 category String? ?
  - line 1455 audience FAQAudience e @default(USER)
  - line 1456 sortOrder Int @default(0) @map("sort_order")
  - line 1457 isActive Boolean n     @default(true) @map("is_active")
  - line 1458 views Int Int         @default(0)
  - line 1459 helpfulYes Int @default(0) @map("helpful_yes")
  - line 1460 helpfulNo Int @default(0) @map("helpful_no")
  - line 1461 createdBy String? @map("created_by")
  - line 1462 createdAt DateTime @default(now()) @map("created_at")
  - line 1463 updatedAt DateTime @updatedAt @map("updated_at")

### TrackingCodeReservation (lines 1476-1491)
- Model attributes:
  - line 1487 @@index([userId])
  - line 1488 @@index([expiresAt])
  - line 1489 @@index([usedAt])
  - line 1490 @@map("tracking_code_reservations")
- Fields:
  - line 1477 id String String    @id @default(cuid())
  - line 1478 code String tring    @unique
  - line 1479 userId String ing    @map("user_id")
  - line 1480 shipmentId String? @unique @map("shipment_id")
  - line 1481 usedAt DateTime? me? @map("used_at")
  - line 1482 expiresAt DateTime @map("expires_at")
  - line 1483 createdAt DateTime @default(now()) @map("created_at")
  - line 1485 user User @relation(fields: [userId], references: [id], onDelete: Cascade)

### RecipientPaymentRequest (lines 1499-1582)
- Model attributes:
  - line 1576 @@index([senderId])
  - line 1577 @@index([paymentToken])
  - line 1578 @@index([status])
  - line 1579 @@index([expiresAt])
  - line 1580 @@index([senderId, status])
  - line 1581 @@map("recipient_payment_requests")
- Fields:
  - line 1500 id String @id @default(uuid())
  - line 1503 senderId String @map("sender_id")
  - line 1504 sender User r   @relation(fields: [senderId], references: [id])
  - line 1507 originAddressId String? g? @map("origin_address_id")
  - line 1508 originCep String String  @map("origin_cep") @db.VarChar(8)
  - line 1509 originCity String String  @map("origin_city")
  - line 1510 originState String String  @map("origin_state") @db.VarChar(2)
  - line 1511 originAddress String? ing? @map("origin_address")
  - line 1512 originNeighborhood String? @map("origin_neighborhood")
  - line 1513 originNumber String? ring? @map("origin_number")
  - line 1514 originComplement String? ? @map("origin_complement")
  - line 1517 recipientName String ing  @map("recipient_name")
  - line 1518 recipientEmail String ng  @map("recipient_email")
  - line 1519 recipientPhone String? g? @map("recipient_phone")
  - line 1520 recipientDocument String? @map("recipient_document")
  - line 1523 destinationCep String String  @map("destination_cep") @db.VarChar(8)
  - line 1524 destinationCity String String  @map("destination_city")
  - line 1525 destinationState String String  @map("destination_state") @db.VarChar(2)
  - line 1526 destinationAddress String? ing? @map("destination_address")
  - line 1527 destinationNeighborhood String? @map("destination_neighborhood")
  - line 1528 destinationNumber String? ring? @map("destination_number")
  - line 1529 destinationComplement String? ? @map("destination_complement")
  - line 1532 totalWeight Float t @map("total_weight")
  - line 1533 declaredValue Float @map("declared_value")
  - line 1536 carrier String tring
  - line 1537 service String tring
  - line 1538 serviceCode String? ? @map("service_code")
  - line 1539 estimatedDays Int? @map("estimated_days")
  - line 1542 freightCostCents Int @map("freight_cost_cents")
  - line 1543 pickupFeeCents Int? ? @map("pickup_fee_cents")
  - line 1544 totalCents Int Int  @map("total_cents")
  - line 1547 shippingCommissionCents Int? @map("shipping_commission_cents")
  - line 1548 pickupCommissionCents Int? ? @map("pickup_commission_cents")
  - line 1551 pickupAtOrigin Boolean @default(false) @map("pickup_at_origin")
  - line 1554 document Json?
  - line 1557 paymentToken String @unique @default(cuid()) @map("payment_token")
  - line 1560 status RecipientPaymentStatus atus @default(PENDING)
  - line 1561 expiresAt DateTime e               @map("expires_at")
  - line 1562 paidAt DateTime? ime?              @map("paid_at")
  - line 1563 cancelledAt DateTime? @map("cancelled_at")
  - line 1566 shipmentId String? @unique @map("shipment_id")
  - line 1567 shipment Shipment? ? @relation(fields: [shipmentId], references: [id])
  - line 1570 packages RecipientPaymentPackage[]
  - line 1573 createdAt DateTime @default(now()) @map("created_at")
  - line 1574 updatedAt DateTime @updatedAt @map("updated_at")

### RecipientPaymentPackage (lines 1586-1600)
- Model attributes:
  - line 1597 @@unique([requestId, packageNumber])
  - line 1598 @@index([requestId])
  - line 1599 @@map("recipient_payment_packages")
- Fields:
  - line 1587 id String String @id @default(uuid())
  - line 1588 requestId String ing @map("request_id")
  - line 1589 packageNumber Int @map("package_number")
  - line 1590 width Float Float
  - line 1591 height Float Float
  - line 1592 length Float Float
  - line 1593 weight Float Float
  - line 1595 request RecipientPaymentRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)

### OpenRouterConfig (lines 1607-1622)
- Model attributes:
  - line 1621 @@map("openrouter_configs")
- Fields:
  - line 1608 id String String   @id @default(cuid())
  - line 1609 apiKey String String
  - line 1610 baseUrl String String   @default("https:
  - line 1611 defaultModel String ing   @default("anthropic/claude-3-haiku") @map("default_model")
  - line 1612 temperature Float loat    @default(0.7)
  - line 1613 maxTokens Int Int      @default(2048) @map("max_tokens")
  - line 1614 streamingEnabled Boolean @default(true) @map("streaming_enabled")
  - line 1615 httpReferer String? ing?  @map("http_referer")
  - line 1616 xTitle String? String?  @map("x_title")
  - line 1617 isActive Boolean Boolean  @default(true) @map("is_active")
  - line 1618 createdAt DateTime teTime @default(now()) @map("created_at")
  - line 1619 updatedAt DateTime teTime @updatedAt @map("updated_at")

### AssistantChatSession (lines 1625-1638)
- Model attributes:
  - line 1635 @@index([userId])
  - line 1636 @@index([userId, updatedAt])
  - line 1637 @@map("assistant_chat_sessions")
- Fields:
  - line 1626 id String String   @id @default(cuid())
  - line 1627 userId String ng   @map("user_id")
  - line 1628 title String? ng?
  - line 1629 createdAt DateTime @default(now()) @map("created_at")
  - line 1630 updatedAt DateTime @updatedAt @map("updated_at")
  - line 1632 user User ser                   @relation(fields: [userId], references: [id], onDelete: Cascade)
  - line 1633 messages AssistantChatMessage[]

### AssistantChatMessage (lines 1641-1656)
- Model attributes:
  - line 1653 @@index([sessionId])
  - line 1654 @@index([sessionId, createdAt])
  - line 1655 @@map("assistant_chat_messages")
- Fields:
  - line 1642 id String String                 @id @default(cuid())
  - line 1643 sessionId String @map("session_id")
  - line 1644 author AssistantMessageAuthor hor
  - line 1645 content String ng                 @db.Text
  - line 1646 toolName String? ?                @map("tool_name")
  - line 1647 toolArgs Json? ?                  @map("tool_args")
  - line 1648 toolResult Json? @map("tool_result")
  - line 1649 createdAt DateTime @default(now()) @map("created_at")
  - line 1651 session AssistantChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

### KnowledgeBaseArticle (lines 1670-1684)
- Model attributes:
  - line 1681 @@index([isPublished])
  - line 1682 @@index([category])
  - line 1683 @@map("knowledge_base_articles")
- Fields:
  - line 1671 id String String   @id @default(cuid())
  - line 1672 slug String String   @unique
  - line 1673 title String String
  - line 1674 contentMarkdown String @map("content_markdown") @db.Text
  - line 1675 tags String[] String[]
  - line 1676 category String? tring?
  - line 1677 isPublished Boolean ean  @default(false) @map("is_published")
  - line 1678 createdAt DateTime eTime @default(now()) @map("created_at")
  - line 1679 updatedAt DateTime eTime @updatedAt @map("updated_at")

## Enums
### CardBrand (lines 982-989)
- Values:
  - line 983 VISA
  - line 984 MASTERCARD
  - line 985 ELO
  - line 986 AMEX
  - line 987 HIPERCARD
  - line 988 OTHER

### StaffStatus (lines 991-994)
- Values:
  - line 992 ACTIVE
  - line 993 BLOCKED

### AdminPermission (lines 996-1006)
- Values:
  - line 997 CONTAS
  - line 998 FINANCEIRO
  - line 999 OPERACOES
  - line 1000 INTEGRACOES
  - line 1001 SUPORTE
  - line 1002 COLETORES
  - line 1003 PONTOS_COLETA
  - line 1004 USUARIOS
  - line 1005 CONFIGURACOES

### WalletTxType (lines 1008-1014)
- Values:
  - line 1009 TOPUP
  - line 1010 PURCHASE
  - line 1011 REFUND
  - line 1012 WITHDRAW
  - line 1013 ADJUSTMENT

### WalletTxStatus (lines 1016-1021)
- Values:
  - line 1017 PENDING
  - line 1018 CONFIRMED
  - line 1019 FAILED
  - line 1020 CANCELED

### SupportTicketStatus (lines 1023-1028)
- Values:
  - line 1024 OPEN
  - line 1025 IN_PROGRESS
  - line 1026 RESOLVED
  - line 1027 CLOSED

### SupportPriority (lines 1030-1035)
- Values:
  - line 1031 LOW
  - line 1032 MEDIUM
  - line 1033 HIGH
  - line 1034 URGENT

### SupportAuthorRole (lines 1037-1040)
- Values:
  - line 1038 USER
  - line 1039 AGENT

### PickupPointStatus (lines 1042-1046)
- Values:
  - line 1043 ACTIVE
  - line 1044 BLOCKED
  - line 1045 PENDING

### ReceptionStatus (lines 1048-1053)
- Values:
  - line 1049 PENDING
  - line 1050 RECEIVED
  - line 1051 ISSUE_REPORTED
  - line 1052 PROCESSED

### QuoteStatus (lines 1055-1061)
- Values:
  - line 1056 DRAFT
  - line 1057 SELECTED
  - line 1058 CONFIRMED
  - line 1059 EXPIRED
  - line 1060 CANCELED

### DocumentType (lines 1063-1066)
- Values:
  - line 1064 NFE
  - line 1065 DECLARATION

### IntegrationEnvironment (lines 1068-1071)
- Values:
  - line 1069 SANDBOX
  - line 1070 PRODUCTION

### IntegrationStatus (lines 1073-1078)
- Values:
  - line 1074 ACTIVE
  - line 1075 INACTIVE
  - line 1076 ERROR
  - line 1077 TESTING

### AuthType (lines 1080-1087)
- Values:
  - line 1081 API_KEY
  - line 1082 OAUTH2
  - line 1083 BASIC
  - line 1084 BEARER
  - line 1085 SIGNED_HEADER
  - line 1086 CUSTOM

### HealthStatus (lines 1089-1094)
- Values:
  - line 1090 HEALTHY
  - line 1091 DEGRADED
  - line 1092 DOWN
  - line 1093 UNKNOWN

### PaymentMethod (lines 1096-1102)
- Values:
  - line 1097 CREDIT_CARD
  - line 1098 DEBIT_CARD
  - line 1099 PIX
  - line 1100 BOLETO
  - line 1101 WALLET

### TransactionStatus (lines 1104-1113)
- Values:
  - line 1105 PENDING
  - line 1106 AUTHORIZED
  - line 1107 CAPTURED
  - line 1108 PAID
  - line 1109 REFUNDED
  - line 1110 CHARGEBACK
  - line 1111 CANCELED
  - line 1112 FAILED

### LedgerEntryType (lines 1115-1122)
- Values:
  - line 1116 CHARGE
  - line 1117 REFUND
  - line 1118 CHARGEBACK
  - line 1119 FEE
  - line 1120 PAYOUT
  - line 1121 ADJUSTMENT

### CollectorStatus (lines 1124-1130)
- Values:
  - line 1125 ACTIVE
  - line 1126 BLOCKED
  - line 1127 INACTIVE
  - line 1129 @@map("collector_status")

### PixKeyType (lines 1132-1140)
- Values:
  - line 1133 CPF
  - line 1134 CNPJ
  - line 1135 EMAIL
  - line 1136 PHONE
  - line 1137 RANDOM
  - line 1139 @@map("pix_key_type")

### AccountType (lines 1142-1147)
- Values:
  - line 1143 CORRENTE
  - line 1144 POUPANCA
  - line 1146 @@map("account_type")

### CommissionKind (lines 1149-1154)
- Values:
  - line 1150 FIXA
  - line 1151 POR_KM
  - line 1153 @@map("commission_kind")

### BankMethodKind (lines 1156-1161)
- Values:
  - line 1157 PIX
  - line 1158 TRANSFER
  - line 1160 @@map("bank_method_kind")

### PickupFeeType (lines 1163-1168)
- Values:
  - line 1164 FIXED
  - line 1165 PER_KM
  - line 1167 @@map("pickup_fee_type")

### EmailConfigStatus (lines 1170-1173)
- Values:
  - line 1171 ACTIVE
  - line 1172 INACTIVE

### RecipientPaymentStatus (lines 1175-1182)
- Values:
  - line 1176 PENDING
  - line 1177 PAID
  - line 1178 EXPIRED
  - line 1179 CANCELLED
  - line 1181 @@map("recipient_payment_status")

### CorreiosAgencyType (lines 1203-1215)
- Values:
  - line 1204 AC
  - line 1205 ACF
  - line 1206 AGF
  - line 1207 CDD
  - line 1208 CTE
  - line 1209 CTCE
  - line 1210 CEE
  - line 1211 CTCI
  - line 1212 OUTROS
  - line 1214 @@map("correios_agency_type")

### CorreiosAgencyStatus (lines 1217-1223)
- Values:
  - line 1218 ATIVA
  - line 1219 INATIVA
  - line 1220 OUTRO
  - line 1222 @@map("correios_agency_status")

### FipeVehicleType (lines 1302-1308)
- Values:
  - line 1303 cars
  - line 1304 motorcycles
  - line 1305 trucks
  - line 1307 @@map("fipe_vehicle_type")

### ExpenseType (lines 1356-1359)
- Values:
  - line 1357 FIXED
  - line 1358 VARIABLE

### ExpenseCategory (lines 1361-1371)
- Values:
  - line 1362 INFRAESTRUTURA
  - line 1363 SOFTWARE
  - line 1364 GATEWAY
  - line 1365 MARKETING
  - line 1366 PESSOAL
  - line 1367 ADMINISTRATIVO
  - line 1368 LOGISTICA
  - line 1369 IMPOSTOS
  - line 1370 OUTROS

### ExpenseStatus (lines 1373-1377)
- Values:
  - line 1374 PENDING
  - line 1375 PAID
  - line 1376 CANCELED

### FAQAudience (lines 1442-1447)
- Values:
  - line 1443 USER
  - line 1444 COLLECTOR
  - line 1446 @@map("faq_audience")

### AssistantMessageAuthor (lines 1659-1663)
- Values:
  - line 1660 USER
  - line 1661 ASSISTANT
  - line 1662 TOOL

