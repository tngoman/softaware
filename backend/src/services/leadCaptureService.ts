import { db } from '../db/mysql.js';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { getSmtpConfig } from './credentialVault.js';

function uuidv4() {
  return crypto.randomUUID();
}

/**
 * Lead Capture Service
 * 
 * Detects when the AI widget identifies a sales opportunity and captures
 * visitor contact information, sending real-time notifications to the business owner.
 * 
 * This is a core feature of the "Advanced" tier (R1,499/month) and above.
 */

interface LeadCaptureData {
  email: string;
  name?: string;
  message?: string;
  chatContext?: string;
}

interface AIResponse {
  message: string;
  action?: 'capture_lead';
  leadData?: LeadCaptureData;
}

/**
 * Parse AI response for lead capture signals
 * The AI is prompted to output JSON when it detects buying intent:
 * {"action": "capture_lead", "email": "user@example.com", "name": "John Doe"}
 */
export function parseLeadCapture(aiResponse: string): AIResponse | null {
  try {
    // Look for JSON blocks in the response
    const jsonMatch = aiResponse.match(/\{[^}]*"action"\s*:\s*"capture_lead"[^}]*\}/);
    
    if (jsonMatch) {
      const leadData = JSON.parse(jsonMatch[0]);
      
      if (leadData.action === 'capture_lead' && leadData.email) {
        return {
          message: aiResponse.replace(jsonMatch[0], '').trim(),
          action: 'capture_lead',
          leadData: {
            email: leadData.email,
            name: leadData.name,
            message: leadData.message,
          }
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing lead capture:', error);
    return null;
  }
}

/**
 * Store captured lead in database
 */
export async function storeCapturedLead(
  clientId: string,
  leadData: LeadCaptureData,
  chatContext?: string
): Promise<string> {
  const leadId = uuidv4();
  
  await db.execute(
    `INSERT INTO widget_leads_captured 
     (id, client_id, visitor_email, visitor_name, visitor_message, chat_context, notification_sent)
     VALUES (?, ?, ?, ?, ?, ?, FALSE)`,
    [
      leadId,
      clientId,
      leadData.email,
      leadData.name || null,
      leadData.message || null,
      chatContext || null
    ]
  );
  
  return leadId;
}

/**
 * Send lead notification email to business owner
 */
export async function sendLeadNotification(
  clientId: string,
  leadData: LeadCaptureData,
  businessName?: string
): Promise<boolean> {
  try {
    // Get client configuration
    const [rows] = await db.execute(
      `SELECT wc.lead_notification_email, wc.website_url, u.email as user_email, u.name as user_name
       FROM widget_clients wc
       LEFT JOIN users u ON wc.user_id = u.id
       WHERE wc.id = ?`,
      [clientId]
    ) as any;
    
    if (!rows || rows.length === 0) {
      console.error(`Client not found: ${clientId}`);
      return false;
    }
    
    const client = rows[0];
    const recipientEmail = client.lead_notification_email || client.user_email;
    
    if (!recipientEmail) {
      console.error(`No notification email configured for client: ${clientId}`);
      return false;
    }
    
    // Create email transporter with vault credentials
    const smtp = await getSmtpConfig();
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user ? {
        user: smtp.user,
        pass: smtp.pass,
      } : undefined,
    });
    
    // Compose email
    const subject = `🎯 New Lead Captured from ${businessName || client.website_url}`;
    
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                    color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .lead-card { background: white; padding: 20px; border-radius: 8px; 
                       box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin: 20px 0; }
          .lead-field { margin: 10px 0; }
          .lead-label { font-weight: bold; color: #667eea; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .cta-button { display: inline-block; background: #667eea; color: white; 
                        padding: 12px 24px; text-decoration: none; border-radius: 6px; 
                        margin: 20px 0; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎯 New Lead Captured!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Your AI assistant identified a sales opportunity</p>
          </div>
          
          <div class="content">
            <p>Great news! A visitor to <strong>${businessName || client.website_url}</strong> 
               expressed interest and provided their contact information.</p>
            
            <div class="lead-card">
              <h2 style="margin-top: 0; color: #667eea;">Lead Information</h2>
              
              ${leadData.name ? `
              <div class="lead-field">
                <span class="lead-label">Name:</span> ${leadData.name}
              </div>
              ` : ''}
              
              <div class="lead-field">
                <span class="lead-label">Email:</span> 
                <a href="mailto:${leadData.email}">${leadData.email}</a>
              </div>
              
              ${leadData.message ? `
              <div class="lead-field">
                <span class="lead-label">Message:</span><br>
                <p style="margin: 10px 0; padding: 15px; background: #f3f4f6; 
                   border-left: 4px solid #667eea; border-radius: 4px;">
                  ${leadData.message}
                </p>
              </div>
              ` : ''}
            </div>
            
            <p><strong>What to do next:</strong></p>
            <ul>
              <li>Reply to the lead within 1 hour for best conversion rates</li>
              <li>Reference the specific topic they were asking about</li>
              <li>Personalize your response based on their needs</li>
            </ul>
            
            <div style="text-align: center;">
              <a href="mailto:${leadData.email}" class="cta-button">
                Reply to Lead
              </a>
            </div>
          </div>
          
          <div class="footer">
            <p>This lead was captured by your Soft Aware AI Assistant</p>
            <p style="font-size: 12px;">
              <a href="https://portal.softaware.net.za" style="color: #667eea;">
                Manage your AI settings
              </a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const plainText = `
New Lead Captured from ${businessName || client.website_url}

${leadData.name ? `Name: ${leadData.name}\n` : ''}Email: ${leadData.email}
${leadData.message ? `\nMessage:\n${leadData.message}\n` : ''}
---
Reply to this lead within 1 hour for best conversion rates.

This lead was captured by your Soft Aware AI Assistant.
Manage settings: https://portal.softaware.net.za
    `.trim();
    
    // Send email
    await transporter.sendMail({
      from: smtp.from,
      to: recipientEmail,
      subject,
      text: plainText,
      html: htmlBody,
      replyTo: leadData.email,
    });
    
    // Mark notification as sent
    await db.execute(
      `UPDATE widget_leads_captured 
       SET notification_sent = TRUE 
       WHERE client_id = ? AND visitor_email = ?
       ORDER BY captured_at DESC
       LIMIT 1`,
      [clientId, leadData.email]
    );
    
    console.log(`✅ Lead notification sent to ${recipientEmail}`);
    return true;
    
  } catch (error) {
    console.error('Error sending lead notification:', error);
    return false;
  }
}

/**
 * Get lead capture statistics for a client
 */
export async function getLeadStats(clientId: string, days: number = 30): Promise<any> {
  const [rows] = await db.execute(
    `SELECT 
       COUNT(*) as total_leads,
       COUNT(DISTINCT visitor_email) as unique_visitors,
       COUNT(CASE WHEN notification_sent = TRUE THEN 1 END) as notifications_sent,
       DATE(captured_at) as capture_date
     FROM widget_leads_captured
     WHERE client_id = ? 
       AND captured_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY DATE(captured_at)
     ORDER BY capture_date DESC`,
    [clientId, days]
  ) as any;
  
  return rows || [];
}

/**
 * Build lead capture system prompt for Advanced tier
 */
export function buildLeadCapturePrompt(): string {
  return `
LEAD CAPTURE INSTRUCTIONS:
If the user expresses strong interest in purchasing, booking, or requesting a quote, gently ask for their email address to provide personalized information or follow up.

When you successfully collect their email (and optionally name), output the following JSON AFTER your natural response:

{"action": "capture_lead", "email": "user@example.com", "name": "John Doe", "message": "brief summary of their interest"}

Example conversation:
User: "How much does it cost for a consultation?"
Assistant: "I'd be happy to provide detailed pricing information. To send you a personalized quote, could I get your email address?"
User: "Sure, it's john@example.com"
Assistant: "Perfect, thank you John! I'll have someone send you a detailed consultation package within the hour. Is there anything specific you'd like to know about our services?"
{"action": "capture_lead", "email": "john@example.com", "name": "John", "message": "Interested in consultation pricing"}

IMPORTANT: Only ask for email when there is genuine buying intent. Don't be pushy.
`.trim();
}
