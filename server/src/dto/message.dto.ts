import {
    IsNotEmpty,
    IsOptional,
    IsString,
    IsEnum,
    MaxLength,
    MinLength,
    Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Enum for message types
 */
export enum MessageTypeEnum {
    TEXT = 'text',
    IMAGE = 'image',
    DOCUMENT = 'document',
    AUDIO = 'audio',
    VIDEO = 'video',
}

/**
 * Enum for message statuses
 */
export enum MessageStatusEnum {
    SENT = 'sent',
    DELIVERED = 'delivered',
    READ = 'read',
    FAILED = 'failed',
}

/**
 * Sanitizes text by removing HTML tags (XSS prevention)
 */
function sanitizeText(value: string): string {
    if (typeof value !== 'string') return value;
    // Remove HTML tags and trim whitespace
    return value
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .trim();
}

/**
 * DTO for sending a new message
 */
export class SendMessageDto {
    @IsString({ message: 'Recipient (to) must be a string' })
    @IsNotEmpty({ message: 'Recipient (to) is required' })
    @Matches(/^(91)?\d{10}$/, {
        message: 'Recipient must be a valid phone number (10 digits, optionally prefixed with 91)',
    })
    to: string;

    @IsString({ message: 'Message text must be a string' })
    @IsNotEmpty({ message: 'Message text is required' })
    @MinLength(1, { message: 'Message cannot be empty' })
    @MaxLength(4000, { message: 'Message cannot exceed 4000 characters' })
    @Transform(({ value }) => sanitizeText(value))
    text: string;

    @IsOptional()
    @IsEnum(MessageTypeEnum, {
        message: 'Type must be one of: text, image, document, audio, video',
    })
    type?: MessageTypeEnum = MessageTypeEnum.TEXT;

    @IsOptional()
    @IsString()
    @MaxLength(64, { message: 'Correlation ID cannot exceed 64 characters' })
    correlationId?: string;
}

/**
 * DTO for updating message status
 */
export class UpdateMessageStatusDto {
    @IsString({ message: 'Status must be a string' })
    @IsNotEmpty({ message: 'Status is required' })
    @IsEnum(MessageStatusEnum, {
        message: 'Status must be one of: sent, delivered, read, failed',
    })
    status: MessageStatusEnum;
}

/**
 * DTO for searching messages
 */
export class SearchMessagesDto {
    @IsString({ message: 'Search query must be a string' })
    @IsNotEmpty({ message: 'Search query is required' })
    @MinLength(1, { message: 'Search query cannot be empty' })
    @MaxLength(200, { message: 'Search query cannot exceed 200 characters' })
    @Transform(({ value }) => sanitizeText(value))
    query: string;

    @IsOptional()
    @IsString()
    conversationId?: string;

    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10) || 1)
    page?: number = 1;

    @IsOptional()
    @Transform(({ value }) => Math.min(parseInt(value, 10) || 25, 100))
    limit?: number = 25;
}

/**
 * DTO for pagination query parameters
 */
export class PaginationQueryDto {
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10) || 1)
    page?: number = 1;

    @IsOptional()
    @Transform(({ value }) => Math.min(parseInt(value, 10) || 25, 100))
    limit?: number = 25;
}
