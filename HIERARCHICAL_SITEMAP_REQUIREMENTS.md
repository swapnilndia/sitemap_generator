# Hierarchical Sitemap Generation - Requirements Document

## 🎯 **Feature Overview**

### **Objective**
Implement a hierarchical sitemap structure for multiple Excel file uploads that creates a parent-child relationship between sitemap files, improving SEO organization and crawlability.

### **Current State**
- Multiple Excel files are uploaded and processed
- Individual sitemap files are generated for each group
- No parent sitemap file that references the group sitemaps
- Flat structure without hierarchy

### **Desired State**
- Main `sitemap.xml` file that acts as a sitemap index
- Group-specific sitemap files (e.g., `products.xml`, `categories.xml`)
- Hierarchical structure: `sitemap.xml` → `group.xml` → individual URLs
- SEO-optimized organization for large websites

## 📋 **Functional Requirements**

### **FR-1: Parent Sitemap Generation**
- **Description**: Generate a main `sitemap.xml` file that serves as a sitemap index
- **Input**: List of generated group sitemap files
- **Output**: XML sitemap index file with references to group sitemaps
- **Format**: Standard sitemap index XML format
- **Location**: Root level of the sitemap package

### **FR-2: Group Sitemap Organization**
- **Description**: Organize URLs into logical groups based on Excel file content
- **Input**: Processed URLs from multiple Excel files
- **Output**: Group-specific sitemap files
- **Grouping Logic**: 
  - By Excel file name (if different files represent different categories)
  - By URL pattern (if URLs contain category indicators)
  - By user-defined grouping configuration
- **File Naming**: `{group_name}.xml` (e.g., `products.xml`, `categories.xml`)

### **FR-3: Hierarchical Structure**
- **Description**: Create a clear parent-child relationship between sitemaps
- **Structure**:
  ```
  sitemap.xml (parent)
  ├── products.xml (child)
  │   ├── product-1-url
  │   ├── product-2-url
  │   └── ...
  ├── categories.xml (child)
  │   ├── category-1-url
  │   ├── category-2-url
  │   └── ...
  └── pages.xml (child)
      ├── page-1-url
      ├── page-2-url
      └── ...
  ```

### **FR-4: Sitemap Index Configuration**
- **Description**: Allow users to configure the sitemap index behavior
- **Configuration Options**:
  - **Index File Name**: Default `sitemap.xml`, customizable
  - **Group Naming Strategy**: Auto-generate or user-defined
  - **URL Structure**: Base URL for sitemap references
  - **Last Modified**: Use current date or file upload date
  - **Priority**: Default priority for group sitemaps

### **FR-5: Group Detection Logic**
- **Description**: Automatically detect logical groups from Excel files
- **Detection Methods**:
  1. **File-based Grouping**: Each Excel file becomes a group
  2. **Column-based Grouping**: Use specific columns to determine groups
  3. **URL Pattern Grouping**: Analyze URL patterns to determine groups
  4. **Manual Grouping**: User-defined group assignments
- **Fallback**: If no clear grouping is detected, use file-based grouping

### **FR-6: Sitemap Index XML Structure**
- **Description**: Generate valid sitemap index XML
- **XML Structure**:
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <sitemap>
      <loc>https://example.com/products.xml</loc>
      <lastmod>2025-01-01</lastmod>
    </sitemap>
    <sitemap>
      <loc>https://example.com/categories.xml</loc>
      <lastmod>2025-01-01</lastmod>
    </sitemap>
  </sitemapindex>
  ```

## 🎨 **User Experience Requirements**

### **UX-1: Configuration Interface**
- **Description**: Provide UI for configuring hierarchical sitemap generation
- **Components**:
  - **Grouping Strategy Selector**: Dropdown with grouping options
  - **Group Naming Input**: Text input for custom group names
  - **Base URL Input**: Text input for sitemap base URL
  - **Index File Name Input**: Text input for main sitemap file name
  - **Preview Section**: Show preview of generated structure

### **UX-2: Group Preview**
- **Description**: Show users how their files will be grouped
- **Display**:
  - **File-to-Group Mapping**: Show which files belong to which groups
  - **Group Statistics**: Show URL count per group
  - **Group Names**: Display generated or user-defined group names
  - **Edit Capability**: Allow users to modify group assignments

### **UX-3: Generation Progress**
- **Description**: Show progress during hierarchical sitemap generation
- **Progress Steps**:
  1. Analyzing files for grouping
  2. Generating group sitemaps
  3. Creating sitemap index
  4. Finalizing package
- **Status Indicators**: Clear progress indicators for each step

### **UX-4: Download Options**
- **Description**: Provide multiple download options for hierarchical sitemaps
- **Options**:
  - **Complete Package**: ZIP with all sitemap files
  - **Individual Files**: Download specific group sitemaps
  - **Sitemap Index Only**: Download just the main sitemap.xml
  - **Group-specific**: Download specific group sitemaps

## 🔧 **Technical Requirements**

### **TR-1: Sitemap Index Generation**
- **Function**: `generateSitemapIndex(groupSitemaps, config)`
- **Input**: Array of group sitemap objects, configuration
- **Output**: XML string for sitemap index
- **Dependencies**: `xmlbuilder2` library
- **Validation**: Ensure valid XML structure

### **TR-2: Group Detection Algorithm**
- **Function**: `detectGroups(files, config)`
- **Input**: Array of processed files, grouping configuration
- **Output**: Map of group names to file arrays
- **Algorithm**:
  1. Analyze file names for patterns
  2. Check URL patterns for category indicators
  3. Apply user-defined grouping rules
  4. Fallback to file-based grouping

### **TR-3: Group Sitemap Generation**
- **Function**: `generateGroupSitemaps(groups, config)`
- **Input**: Grouped files, sitemap configuration
- **Output**: Array of group sitemap objects
- **Process**:
  1. Generate XML for each group
  2. Apply URL limits per sitemap
  3. Handle large groups with multiple files
  4. Generate appropriate file names

### **TR-4: File Naming Convention**
- **Description**: Establish consistent naming for sitemap files
- **Convention**:
  - **Main Index**: `sitemap.xml` (configurable)
  - **Group Files**: `{group_name}.xml`
  - **Large Groups**: `{group_name}_part_{number}.xml`
  - **Special Characters**: Sanitize group names for file system

### **TR-5: URL Structure**
- **Description**: Generate proper URLs for sitemap references
- **Structure**: `{base_url}/{sitemap_file_name}`
- **Configuration**: User-defined base URL
- **Validation**: Ensure URLs are properly formatted
- **HTTPS**: Prefer HTTPS URLs for production

### **TR-6: Integration with Existing System**
- **Description**: Integrate with current batch sitemap generation
- **Integration Points**:
  - **Batch Upload**: Extend existing batch upload workflow
  - **Sitemap Generation**: Enhance existing sitemap generation API
  - **Download System**: Extend existing download functionality
  - **Storage System**: Use existing hybrid storage approach

## 📊 **Data Requirements**

### **DR-1: Group Configuration Schema**
```javascript
{
  groupingStrategy: 'file-based' | 'column-based' | 'url-pattern' | 'manual',
  groupNames: {
    'file1.xlsx': 'products',
    'file2.xlsx': 'categories'
  },
  baseUrl: 'https://example.com',
  indexFileName: 'sitemap.xml',
  maxUrlsPerSitemap: 50000,
  includeLastmod: true,
  lastmodField: 'updated_at'
}
```

### **DR-2: Group Sitemap Object Schema**
```javascript
{
  groupName: 'products',
  fileName: 'products.xml',
  urls: [
    {
      loc: 'https://example.com/product/1',
      lastmod: '2025-01-01',
      changefreq: 'weekly',
      priority: '0.8'
    }
  ],
  urlCount: 1500,
  fileSize: 245760
}
```

### **DR-3: Sitemap Index Object Schema**
```javascript
{
  fileName: 'sitemap.xml',
  sitemaps: [
    {
      loc: 'https://example.com/products.xml',
      lastmod: '2025-01-01'
    }
  ],
  totalGroups: 3,
  totalUrls: 5000
}
```

## 🚀 **Implementation Phases**

### **Phase 1: Core Functionality**
- **Duration**: 1-2 days
- **Deliverables**:
  - Group detection algorithm
  - Sitemap index generation
  - Basic group sitemap generation
  - Integration with existing batch system

### **Phase 2: User Interface**
- **Duration**: 1-2 days
- **Deliverables**:
  - Configuration interface
  - Group preview component
  - Progress indicators
  - Download options

### **Phase 3: Advanced Features**
- **Duration**: 1 day
- **Deliverables**:
  - Advanced grouping strategies
  - Custom group naming
  - URL pattern analysis
  - Validation and error handling

### **Phase 4: Testing & Optimization**
- **Duration**: 1 day
- **Deliverables**:
  - Comprehensive testing
  - Performance optimization
  - Error handling
  - Documentation

## 🧪 **Testing Requirements**

### **Test Cases**

#### **TC-1: File-based Grouping**
- **Input**: 3 Excel files (products.xlsx, categories.xlsx, pages.xlsx)
- **Expected**: 3 group sitemaps + 1 index sitemap
- **Validation**: Check group names match file names

#### **TC-2: Column-based Grouping**
- **Input**: Excel files with 'category' column
- **Expected**: Groups based on category values
- **Validation**: Check URLs are properly grouped

#### **TC-3: URL Pattern Grouping**
- **Input**: URLs with patterns like /products/, /categories/
- **Expected**: Groups based on URL patterns
- **Validation**: Check pattern detection accuracy

#### **TC-4: Large Group Handling**
- **Input**: Group with 100,000+ URLs
- **Expected**: Multiple sitemap files for large groups
- **Validation**: Check URL limits are respected

#### **TC-5: Sitemap Index Validation**
- **Input**: Generated sitemap index
- **Expected**: Valid XML structure
- **Validation**: Check XML schema compliance

## 📈 **Success Metrics**

### **Functional Metrics**
- ✅ **Group Detection Accuracy**: 95%+ correct grouping
- ✅ **XML Validation**: 100% valid XML output
- ✅ **URL Limit Compliance**: Respect 50,000 URL limit per sitemap
- ✅ **File Generation**: All expected files generated

### **Performance Metrics**
- ✅ **Generation Time**: < 30 seconds for 10,000 URLs
- ✅ **Memory Usage**: < 500MB peak usage
- ✅ **File Size**: Optimized XML output
- ✅ **Download Speed**: < 10 seconds for complete package

### **User Experience Metrics**
- ✅ **Configuration Time**: < 2 minutes to configure
- ✅ **Preview Accuracy**: 100% accurate preview
- ✅ **Error Rate**: < 1% generation failures
- ✅ **User Satisfaction**: Positive feedback on hierarchy

## 🔒 **Security & Validation**

### **Input Validation**
- **File Types**: Only Excel files allowed
- **File Size**: Respect size limits
- **URL Validation**: Validate URL formats
- **Group Names**: Sanitize group names for file system

### **Output Validation**
- **XML Structure**: Validate XML schema
- **URL Limits**: Respect sitemap URL limits
- **File Names**: Ensure safe file names
- **Content Security**: Prevent XSS in generated content

## 📚 **Documentation Requirements**

### **User Documentation**
- **Feature Overview**: Explain hierarchical sitemap benefits
- **Configuration Guide**: Step-by-step configuration
- **Grouping Strategies**: Explain different grouping options
- **Troubleshooting**: Common issues and solutions

### **Technical Documentation**
- **API Documentation**: Document new API endpoints
- **Code Comments**: Comprehensive code documentation
- **Architecture**: Explain system architecture
- **Testing Guide**: How to test the feature

## 🎯 **Acceptance Criteria**

### **Must Have**
- ✅ Generate sitemap index file
- ✅ Create group-specific sitemap files
- ✅ Support file-based grouping
- ✅ Integrate with existing batch system
- ✅ Provide download options

### **Should Have**
- ✅ Support column-based grouping
- ✅ Support URL pattern grouping
- ✅ Custom group naming
- ✅ Configuration interface
- ✅ Group preview

### **Could Have**
- ✅ Advanced grouping strategies
- ✅ Custom sitemap templates
- ✅ Analytics integration
- ✅ Automated group optimization
- ✅ Multi-language support

## 🚀 **Future Enhancements**

### **Advanced Features**
- **Dynamic Grouping**: AI-powered group detection
- **Custom Templates**: User-defined sitemap templates
- **Analytics Integration**: Track sitemap performance
- **Automated Updates**: Schedule sitemap regeneration
- **Multi-language**: Support for multiple languages

### **Integration Opportunities**
- **SEO Tools**: Integration with SEO platforms
- **CDN Integration**: Automatic CDN deployment
- **Search Console**: Direct submission to Google
- **Analytics**: Track sitemap usage and performance

---

*Requirements Document Version: 1.0*
*Created: September 2, 2025*
*Status: Ready for Implementation*
*Priority: High*
