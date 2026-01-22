export interface ComplaintAcknowledgementData {
  complaintCode: string;
  submittedAt: string;
  districtName: string;
  complaintType: string;
  complaintNature: string;
  address?: string;
  trackingUrl: string;
}

export function generateAcknowledgementHTML(data: ComplaintAcknowledgementData): string {
  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Complaint Acknowledgement - ${data.complaintCode}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: #f5f5f5;
          padding: 20px;
          color: #333;
        }
        
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        
        .header {
          background: linear-gradient(135deg, #1a5f7a, #0d3d52);
          color: white;
          padding: 30px 24px;
          text-align: center;
        }
        
        .header h1 {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        
        .header h2 {
          font-size: 14px;
          font-weight: 400;
          opacity: 0.9;
        }
        
        .success-badge {
          background: #28a745;
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          display: inline-block;
          margin-top: 16px;
        }
        
        .content {
          padding: 30px 24px;
        }
        
        .complaint-id-section {
          background: #f8f9fa;
          border: 2px dashed #1a5f7a;
          border-radius: 12px;
          padding: 24px;
          text-align: center;
          margin-bottom: 24px;
        }
        
        .complaint-id-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 8px;
        }
        
        .complaint-id {
          font-size: 28px;
          font-weight: 700;
          color: #1a5f7a;
          letter-spacing: 2px;
          font-family: 'Courier New', monospace;
        }
        
        .submitted-at {
          font-size: 13px;
          color: #666;
          margin-top: 12px;
        }
        
        .details-section {
          margin-bottom: 24px;
        }
        
        .section-title {
          font-size: 14px;
          font-weight: 600;
          color: #1a5f7a;
          margin-bottom: 16px;
          padding-bottom: 8px;
          border-bottom: 2px solid #e9ecef;
        }
        
        .detail-row {
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid #f0f0f0;
        }
        
        .detail-label {
          font-size: 13px;
          color: #666;
          flex-shrink: 0;
        }
        
        .detail-value {
          font-size: 13px;
          font-weight: 500;
          color: #333;
          text-align: right;
          max-width: 60%;
        }
        
        .tracking-section {
          background: #e8f4f8;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 24px;
        }
        
        .tracking-title {
          font-size: 14px;
          font-weight: 600;
          color: #1a5f7a;
          margin-bottom: 8px;
        }
        
        .tracking-url {
          font-size: 12px;
          color: #0d6efd;
          word-break: break-all;
        }
        
        .tracking-note {
          font-size: 11px;
          color: #666;
          margin-top: 12px;
          line-height: 1.5;
        }
        
        .info-box {
          background: #fff3cd;
          border-left: 4px solid #ffc107;
          border-radius: 0 8px 8px 0;
          padding: 16px;
          margin-bottom: 24px;
        }
        
        .info-box h4 {
          font-size: 13px;
          font-weight: 600;
          color: #856404;
          margin-bottom: 8px;
        }
        
        .info-box p {
          font-size: 12px;
          color: #856404;
          line-height: 1.5;
        }
        
        .footer {
          background: #f8f9fa;
          padding: 20px 24px;
          text-align: center;
          border-top: 1px solid #e9ecef;
        }
        
        .footer-text {
          font-size: 11px;
          color: #666;
          line-height: 1.6;
        }
        
        .footer-logo {
          font-size: 14px;
          font-weight: 700;
          color: #1a5f7a;
          margin-top: 12px;
        }
        
        @media print {
          body {
            padding: 0;
            background: white;
          }
          .container {
            box-shadow: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Food Safety and Standards Authority of India</h1>
          <h2>Complaint Acknowledgement Receipt</h2>
          <div class="success-badge">Successfully Submitted</div>
        </div>
        
        <div class="content">
          <div class="complaint-id-section">
            <div class="complaint-id-label">Your Complaint ID</div>
            <div class="complaint-id">${data.complaintCode}</div>
            <div class="submitted-at">Submitted on ${formatDateTime(data.submittedAt)}</div>
          </div>
          
          <div class="details-section">
            <div class="section-title">Complaint Details</div>
            <div class="detail-row">
              <span class="detail-label">Assigned District</span>
              <span class="detail-value">${data.districtName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Complaint Type</span>
              <span class="detail-value">${data.complaintType}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Nature</span>
              <span class="detail-value">${data.complaintNature}</span>
            </div>
            ${data.address ? `
            <div class="detail-row">
              <span class="detail-label">Location</span>
              <span class="detail-value">${data.address}</span>
            </div>
            ` : ''}
          </div>
          
          <div class="tracking-section">
            <div class="tracking-title">Track Your Complaint</div>
            <div class="tracking-url">${data.trackingUrl}</div>
            <div class="tracking-note">
              Use the Complaint ID above to track the status of your complaint online. 
              Updates will be reflected as the investigation progresses.
            </div>
          </div>
          
          <div class="info-box">
            <h4>What happens next?</h4>
            <p>
              Your complaint has been registered and will be reviewed by a Food Safety Officer. 
              You may be contacted for additional information if required. 
              The estimated response time is 7-14 working days.
            </p>
          </div>
        </div>
        
        <div class="footer">
          <div class="footer-text">
            This is a computer-generated document and does not require a signature.<br>
            For queries, contact your local Food Safety Office or visit fssai.gov.in
          </div>
          <div class="footer-logo">FSSAI</div>
        </div>
      </div>
    </body>
    </html>
  `;
}
