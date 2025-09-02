# Hierarchical Sitemap Architecture

## 🏗️ **System Architecture**

### **Current Flow**
```
Multiple Excel Files → Batch Upload → Individual Sitemaps → Download
```

### **New Hierarchical Flow**
```
Multiple Excel Files → Batch Upload → Group Detection → Group Sitemaps → Sitemap Index → Download
```

## 📊 **Visual Structure**

### **File Organization**
```
📁 Sitemap Package
├── 📄 sitemap.xml (Main Index)
├── 📄 products.xml (Group 1)
├── 📄 categories.xml (Group 2)
├── 📄 pages.xml (Group 3)
└── 📄 products_part_2.xml (Large Group Split)
```

### **XML Hierarchy**
```
sitemap.xml (Sitemap Index)
├── <sitemap>
│   ├── <loc>https://example.com/products.xml</loc>
│   └── <lastmod>2025-01-01</lastmod>
├── <sitemap>
│   ├── <loc>https://example.com/categories.xml</loc>
│   └── <lastmod>2025-01-01</lastmod>
└── <sitemap>
    ├── <loc>https://example.com/pages.xml</loc>
    └── <lastmod>2025-01-01</lastmod>
```

### **Group Sitemap Structure**
```
products.xml (Group Sitemap)
├── <url>
│   ├── <loc>https://example.com/product/1</loc>
│   ├── <lastmod>2025-01-01</lastmod>
│   ├── <changefreq>weekly</changefreq>
│   └── <priority>0.8</priority>
├── <url>
│   ├── <loc>https://example.com/product/2</loc>
│   └── ...
└── ...
```

## 🔄 **Data Flow**

### **1. Upload Phase**
```
Excel Files → File Analysis → Group Detection → Group Assignment
```

### **2. Processing Phase**
```
Group Assignment → URL Processing → Group Sitemap Generation → Index Creation
```

### **3. Output Phase**
```
Sitemap Files → Package Creation → Download Options → User Delivery
```

## 🎯 **Grouping Strategies**

### **Strategy 1: File-based Grouping**
```
products.xlsx → products.xml
categories.xlsx → categories.xml
pages.xlsx → pages.xml
```

### **Strategy 2: Column-based Grouping**
```
Excel File with 'category' column:
├── category: 'electronics' → electronics.xml
├── category: 'clothing' → clothing.xml
└── category: 'books' → books.xml
```

### **Strategy 3: URL Pattern Grouping**
```
URLs with patterns:
├── /products/* → products.xml
├── /categories/* → categories.xml
└── /pages/* → pages.xml
```

### **Strategy 4: Manual Grouping**
```
User-defined groups:
├── Group A: file1.xlsx + file3.xlsx → group_a.xml
├── Group B: file2.xlsx → group_b.xml
└── Group C: file4.xlsx + file5.xlsx → group_c.xml
```

## 🔧 **Technical Implementation**

### **API Endpoints**
```
POST /api/batch-sitemap-generate-hierarchical
├── Input: batchId, groupingConfig
├── Process: Group detection → Sitemap generation → Index creation
└── Output: hierarchicalSitemapJobId

GET /api/batch-sitemap-hierarchical-status/[jobId]
├── Input: jobId
├── Process: Check generation status
└── Output: status, progress, groupInfo

POST /api/batch-sitemap-hierarchical-download
├── Input: jobId, downloadType
├── Process: Package sitemap files
└── Output: downloadToken
```

### **Database Schema**
```javascript
// Hierarchical Sitemap Job
{
  jobId: 'hierarchical_sitemap_1234567890_abc123',
  batchId: 'batch_1234567890_abc123',
  status: 'processing' | 'completed' | 'failed',
  groupingConfig: {
    strategy: 'file-based',
    groupNames: {},
    baseUrl: 'https://example.com',
    indexFileName: 'sitemap.xml'
  },
  groups: [
    {
      groupName: 'products',
      fileName: 'products.xml',
      urlCount: 1500,
      fileSize: 245760
    }
  ],
  sitemapIndex: {
    fileName: 'sitemap.xml',
    totalGroups: 3,
    totalUrls: 5000
  },
  createdAt: '2025-01-01T00:00:00Z',
  completedAt: '2025-01-01T00:05:00Z'
}
```

### **File Storage Structure**
```
/tmp/sitemaps/hierarchical_sitemap_1234567890_abc123/
├── sitemap.xml (Main Index)
├── products.xml
├── categories.xml
├── pages.xml
└── metadata.json
```

## 🎨 **User Interface Components**

### **Configuration Panel**
```
┌─────────────────────────────────────┐
│ Hierarchical Sitemap Configuration  │
├─────────────────────────────────────┤
│ Grouping Strategy: [File-based ▼]   │
│ Base URL: [https://example.com]     │
│ Index File: [sitemap.xml]           │
│ Max URLs per Sitemap: [50000]       │
├─────────────────────────────────────┤
│ Group Preview:                      │
│ ├── products.xlsx → products.xml    │
│ ├── categories.xlsx → categories.xml│
│ └── pages.xlsx → pages.xml          │
├─────────────────────────────────────┤
│ [Generate Hierarchical Sitemap]     │
└─────────────────────────────────────┘
```

### **Progress Indicator**
```
┌─────────────────────────────────────┐
│ Generating Hierarchical Sitemap     │
├─────────────────────────────────────┤
│ Step 1: Analyzing files...     ✓    │
│ Step 2: Detecting groups...    ✓    │
│ Step 3: Generating sitemaps... ●    │
│ Step 4: Creating index...      ○    │
├─────────────────────────────────────┤
│ Progress: 75% (3/4 steps)           │
└─────────────────────────────────────┘
```

### **Download Options**
```
┌─────────────────────────────────────┐
│ Download Hierarchical Sitemap       │
├─────────────────────────────────────┤
│ [📦 Complete Package (ZIP)]         │
│ [📄 Sitemap Index Only]             │
│ [📄 Individual Group Sitemaps]      │
├─────────────────────────────────────┤
│ Generated Files:                    │
│ ├── sitemap.xml (Main Index)        │
│ ├── products.xml (1,500 URLs)       │
│ ├── categories.xml (800 URLs)       │
│ └── pages.xml (200 URLs)            │
└─────────────────────────────────────┘
```

## 🚀 **Implementation Plan**

### **Phase 1: Core Logic (Day 1)**
1. **Group Detection Algorithm**
   - Implement file-based grouping
   - Add column-based grouping
   - Add URL pattern grouping
   - Add manual grouping

2. **Sitemap Index Generation**
   - Create XML structure
   - Add validation
   - Handle multiple groups

3. **Integration with Existing System**
   - Extend batch sitemap generation
   - Add hierarchical options
   - Maintain backward compatibility

### **Phase 2: User Interface (Day 2)**
1. **Configuration Component**
   - Grouping strategy selector
   - Base URL input
   - Group preview
   - Validation

2. **Progress Component**
   - Step indicators
   - Progress bar
   - Status updates
   - Error handling

3. **Download Component**
   - Multiple download options
   - File listing
   - Package information

### **Phase 3: Testing & Polish (Day 3)**
1. **Comprehensive Testing**
   - Unit tests
   - Integration tests
   - End-to-end tests
   - Performance tests

2. **Error Handling**
   - Validation errors
   - Generation failures
   - Network issues
   - User feedback

3. **Documentation**
   - User guide
   - API documentation
   - Code comments
   - Examples

## 📊 **Performance Considerations**

### **Memory Management**
- **Streaming**: Process large files in chunks
- **Caching**: Cache group detection results
- **Cleanup**: Remove temporary files
- **Limits**: Respect memory limits

### **File Size Optimization**
- **Compression**: Use gzip compression
- **Chunking**: Split large groups
- **Validation**: Check file size limits
- **Efficiency**: Optimize XML generation

### **Scalability**
- **Concurrent Processing**: Process groups in parallel
- **Queue Management**: Handle multiple requests
- **Resource Limits**: Respect server limits
- **Monitoring**: Track performance metrics

## 🔒 **Security & Validation**

### **Input Validation**
- **File Types**: Only Excel files
- **File Size**: Respect limits
- **URL Validation**: Validate URL formats
- **Group Names**: Sanitize names

### **Output Validation**
- **XML Structure**: Validate schema
- **URL Limits**: Respect sitemap limits
- **File Names**: Ensure safety
- **Content Security**: Prevent XSS

## 📈 **Success Metrics**

### **Functional Metrics**
- ✅ **Group Detection**: 95%+ accuracy
- ✅ **XML Validation**: 100% valid output
- ✅ **URL Limits**: Respect 50K limit
- ✅ **File Generation**: All files created

### **Performance Metrics**
- ✅ **Generation Time**: < 30 seconds
- ✅ **Memory Usage**: < 500MB peak
- ✅ **File Size**: Optimized output
- ✅ **Download Speed**: < 10 seconds

### **User Experience Metrics**
- ✅ **Configuration Time**: < 2 minutes
- ✅ **Preview Accuracy**: 100% accurate
- ✅ **Error Rate**: < 1% failures
- ✅ **User Satisfaction**: Positive feedback

---

*Architecture Document Version: 1.0*
*Created: September 2, 2025*
*Status: Ready for Implementation*
*Priority: High*
