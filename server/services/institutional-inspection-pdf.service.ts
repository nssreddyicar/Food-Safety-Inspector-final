import PDFDocument from 'pdfkit';
import { db } from '../db';
import { 
  institutionalInspections, 
  institutionalInspectionResponses,
  institutionTypes,
  institutionalInspectionPillars,
  institutionalInspectionIndicators
} from '../../shared/schema';
import { eq } from 'drizzle-orm';

interface InspectionReportData {
  inspection: any;
  institutionType: any;
  responses: any[];
  pillars: any[];
}

const RISK_COLORS = {
  high: { r: 220, g: 38, b: 38 },
  medium: { r: 217, g: 119, b: 6 },
  low: { r: 5, g: 150, b: 105 },
};

export class InstitutionalInspectionPdfService {
  async generateReport(inspectionId: string): Promise<Buffer> {
    const data = await this.fetchInspectionData(inspectionId);
    return this.createPdf(data);
  }

  private async fetchInspectionData(inspectionId: string): Promise<InspectionReportData> {
    const [inspection] = await db
      .select()
      .from(institutionalInspections)
      .where(eq(institutionalInspections.id, inspectionId));

    if (!inspection) {
      throw new Error('Inspection not found');
    }

    const [instType] = await db
      .select()
      .from(institutionTypes)
      .where(eq(institutionTypes.id, inspection.institutionTypeId));

    const responses = await db
      .select()
      .from(institutionalInspectionResponses)
      .where(eq(institutionalInspectionResponses.inspectionId, inspectionId));

    const pillars = await db
      .select()
      .from(institutionalInspectionPillars)
      .orderBy(institutionalInspectionPillars.pillarNumber);

    const pillarsWithIndicators = await Promise.all(
      pillars.map(async (pillar) => {
        const indicators = await db
          .select()
          .from(institutionalInspectionIndicators)
          .where(eq(institutionalInspectionIndicators.pillarId, pillar.id))
          .orderBy(institutionalInspectionIndicators.indicatorNumber);
        return { ...pillar, indicators };
      })
    );

    return {
      inspection,
      institutionType: instType,
      responses,
      pillars: pillarsWithIndicators,
    };
  }

  private createPdf(data: InspectionReportData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 50,
        info: {
          Title: `Institutional Inspection Report - ${data.inspection.inspectionCode}`,
          Author: 'Food Safety Department',
        }
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.addHeader(doc, data);
      this.addInstitutionDetails(doc, data);
      this.addRiskSummary(doc, data);
      this.addPillarDetails(doc, data);
      this.addImageAppendix(doc, data);
      this.addFooter(doc, data);

      doc.end();
    });
  }

  private addHeader(doc: PDFKit.PDFDocument, data: InspectionReportData) {
    doc.fontSize(18).font('Helvetica-Bold')
      .text('INSTITUTIONAL FOOD SAFETY INSPECTION REPORT', { align: 'center' });
    
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica')
      .text('Food Safety and Standards Authority of India (FSSAI)', { align: 'center' });
    
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();
  }

  private addInstitutionDetails(doc: PDFKit.PDFDocument, data: InspectionReportData) {
    const { inspection, institutionType } = data;

    doc.fontSize(14).font('Helvetica-Bold').text('INSTITUTION DETAILS');
    doc.moveDown(0.5);

    const details = [
      ['Inspection Code:', inspection.inspectionCode],
      ['Institution Type:', institutionType?.name || 'N/A'],
      ['Institution Name:', inspection.institutionName],
      ['Address:', inspection.institutionAddress],
      ['Inspection Date:', new Date(inspection.inspectionDate).toLocaleDateString('en-IN')],
      ['GPS Location:', inspection.latitude && inspection.longitude 
        ? `${inspection.latitude}, ${inspection.longitude}` 
        : 'Not captured'],
    ];

    doc.fontSize(10).font('Helvetica');
    details.forEach(([label, value]) => {
      doc.font('Helvetica-Bold').text(label, { continued: true });
      doc.font('Helvetica').text(` ${value}`);
    });

    if (inspection.headOfInstitution) {
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').text('Head of Institution:');
      const head = inspection.headOfInstitution as any;
      doc.font('Helvetica').text(`  Name: ${head.name || 'N/A'}`);
      doc.text(`  Mobile: ${head.mobile || 'N/A'}`);
    }

    if (inspection.contractorCookServiceProvider) {
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').text('Contractor / Cook / Service Provider:');
      const contractor = inspection.contractorCookServiceProvider as any;
      doc.font('Helvetica').text(`  Name: ${contractor.name || 'N/A'}`);
      doc.text(`  FSSAI License: ${contractor.fssaiLicense || 'N/A'}`);
    }

    doc.moveDown();
  }

  private addRiskSummary(doc: PDFKit.PDFDocument, data: InspectionReportData) {
    const { inspection } = data;

    doc.fontSize(14).font('Helvetica-Bold').text('RISK ASSESSMENT SUMMARY');
    doc.moveDown(0.5);

    const riskColor = RISK_COLORS[inspection.riskClassification as keyof typeof RISK_COLORS] 
      || { r: 107, g: 114, b: 128 };

    doc.fontSize(12);
    doc.font('Helvetica-Bold').text('Total Risk Score: ', { continued: true });
    doc.font('Helvetica').text(`${inspection.totalScore || 0}`);

    doc.font('Helvetica-Bold').text('Risk Classification: ', { continued: true });
    doc.fillColor([riskColor.r, riskColor.g, riskColor.b])
      .text((inspection.riskClassification || 'Pending').toUpperCase());
    doc.fillColor('black');

    doc.font('Helvetica-Bold').text('High Risk Indicators Failed: ', { continued: true });
    doc.font('Helvetica').text(`${inspection.highRiskCount || 0}`);

    doc.font('Helvetica-Bold').text('Status: ', { continued: true });
    doc.font('Helvetica').text(inspection.status.toUpperCase());

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();
  }

  private addPillarDetails(doc: PDFKit.PDFDocument, data: InspectionReportData) {
    const { pillars, responses } = data;
    const responseMap = new Map(responses.map(r => [r.indicatorId, r]));

    doc.fontSize(14).font('Helvetica-Bold').text('DETAILED ASSESSMENT');
    doc.moveDown(0.5);

    pillars.forEach((pillar: any, pillarIndex: number) => {
      if (doc.y > 700) {
        doc.addPage();
      }

      doc.fontSize(12).font('Helvetica-Bold')
        .text(`${pillar.pillarNumber}. ${pillar.name}`);
      doc.moveDown(0.3);

      pillar.indicators.forEach((indicator: any) => {
        const response = responseMap.get(indicator.id);
        const responseValue = response?.response || 'N/A';
        const riskColor = RISK_COLORS[indicator.riskLevel as keyof typeof RISK_COLORS];

        doc.fontSize(9).font('Helvetica');
        
        const riskLabel = `[${indicator.riskLevel.toUpperCase()} - Weight: ${indicator.weight}]`;
        const responseLabel = responseValue.toUpperCase();

        doc.text(`  ${indicator.indicatorNumber}. ${indicator.name}`, { continued: false });
        doc.text(`     Risk: ${riskLabel}  |  Response: ${responseLabel}`);
        
        if (response?.remarks) {
          doc.text(`     Remarks: ${response.remarks}`);
        }
      });

      doc.moveDown(0.5);
    });
  }

  private addImageAppendix(doc: PDFKit.PDFDocument, data: InspectionReportData) {
    const { responses } = data;
    
    // Collect all images with their indicator names
    const allImages: { indicatorName: string; imageData: string }[] = [];
    
    responses.forEach((response: any) => {
      const images = response.images as string[] | null;
      if (images && Array.isArray(images) && images.length > 0) {
        images.forEach((imgData: string) => {
          allImages.push({
            indicatorName: response.indicatorName || 'Unknown Indicator',
            imageData: imgData,
          });
        });
      }
    });

    if (allImages.length === 0) {
      return; // No images to display
    }

    // Start new page for image appendix
    doc.addPage();
    
    doc.fontSize(14).font('Helvetica-Bold')
      .text('PHOTOGRAPHIC EVIDENCE', { align: 'center' });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    // Grid settings: 2 columns, 5 rows = 10 images per page
    const pageWidth = 495; // 545 - 50 margins
    const colWidth = pageWidth / 2;
    const imageWidth = colWidth - 20; // 10px padding on each side
    const imageHeight = 100; // Height for each image
    const captionHeight = 25; // Space for indicator name caption
    const rowHeight = imageHeight + captionHeight + 10; // Total height per cell
    const imagesPerPage = 10;
    const startX = 50;
    const startY = doc.y;

    let imageIndex = 0;
    
    allImages.forEach((img, idx) => {
      // Check if we need a new page (after every 10 images)
      if (idx > 0 && idx % imagesPerPage === 0) {
        doc.addPage();
        doc.fontSize(14).font('Helvetica-Bold')
          .text('PHOTOGRAPHIC EVIDENCE (continued)', { align: 'center' });
        doc.moveDown();
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown();
        imageIndex = 0;
      }

      const col = imageIndex % 2;
      const row = Math.floor(imageIndex % imagesPerPage / 2);
      
      const x = startX + (col * colWidth) + 10;
      const y = (idx < imagesPerPage ? startY : doc.y) + (row * rowHeight);

      try {
        // Try to embed the image
        if (img.imageData && img.imageData.startsWith('data:image')) {
          // Convert base64 data URI to buffer
          const base64Data = img.imageData.split(',')[1];
          if (base64Data) {
            const imageBuffer = Buffer.from(base64Data, 'base64');
            doc.image(imageBuffer, x, y, { 
              width: imageWidth, 
              height: imageHeight,
              fit: [imageWidth, imageHeight],
            });
          }
        }
      } catch (error) {
        // If image fails, draw a placeholder box
        doc.rect(x, y, imageWidth, imageHeight).stroke();
        doc.fontSize(8).text('Image unavailable', x + 20, y + 40);
      }

      // Add indicator name caption below image
      doc.fontSize(8).font('Helvetica')
        .text(
          img.indicatorName.substring(0, 40) + (img.indicatorName.length > 40 ? '...' : ''),
          x, 
          y + imageHeight + 5,
          { width: imageWidth, align: 'center' }
        );

      imageIndex++;
    });

    doc.moveDown(2);
  }

  private addFooter(doc: PDFKit.PDFDocument, data: InspectionReportData) {
    const { inspection } = data;

    if (doc.y > 650) {
      doc.addPage();
    }

    doc.moveDown(2);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    doc.fontSize(10).font('Helvetica');
    doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`);
    doc.text(`Officer ID: ${inspection.officerId || 'N/A'}`);
    
    if (inspection.submittedAt) {
      doc.text(`Submitted on: ${new Date(inspection.submittedAt).toLocaleString('en-IN')}`);
    }

    doc.moveDown();
    doc.fontSize(8).font('Helvetica-Oblique')
      .text('This is a computer-generated document. This report is generated for official use only.', 
        { align: 'center' });
  }
}

export const institutionalInspectionPdfService = new InstitutionalInspectionPdfService();
