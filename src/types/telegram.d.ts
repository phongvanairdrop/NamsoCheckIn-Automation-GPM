/**
 * Type declaration for node-telegram-bot-api
 */

declare module 'node-telegram-bot-api' {
  interface SendMessageOptions {
    parse_mode?: 'Markdown' | 'MarkdownV2' | 'HTML';
    disable_web_page_preview?: boolean;
    disable_notification?: boolean;
    reply_to_message_id?: number;
  }

  export default class TelegramBot {
    constructor(token: string, options?: { polling: boolean });
    sendMessage(chatId: string, text: string, options?: SendMessageOptions): Promise<any>;
  }
}
