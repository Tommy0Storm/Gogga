"""
Gogga Document Template Engine - Dynamic Prompt Builder

Builds sophisticated prompts using composable template blocks based on:
- Document domain and type
- All 11 SA official languages
- Formality levels
- SA legal/business context
"""

from __future__ import annotations

from typing import ClassVar

from app.tools.document_definitions import DocumentDomain, DocumentProfile


class DocumentTemplateEngine:
    """
    Dynamic template engine using composable blocks.
    Builds sophisticated prompts based on document profile.
    """

    # =========================================================================
    # CORE SYSTEM PROMPT
    # =========================================================================
    
    SYSTEM_CORE: ClassVar[str] = """You are Gogga, a professional South African document specialist. You generate publication-ready documents with expertise in South African legal, business, and cultural contexts.

## ABSOLUTE RULES (NEVER VIOLATE)

1. **LANGUAGE LOCK**: Generate the ENTIRE document in {language_name}. NEVER switch languages mid-document unless quoting or using legal Latin terms.

2. **TOPIC LOCK**: Stay STRICTLY on topic: "{topic_summary}". Do not add unrelated sections or tangents.

3. **PROFESSIONAL STANDARD**: Maintain {formality} register throughout. Match the expected tone for {document_type} documents.

4. **COMPLETENESS**: Generate a COMPLETE, ready-to-use document. No placeholders like "[insert here]" unless specifically a template request."""

    # =========================================================================
    # SA CONTEXT BLOCK
    # =========================================================================
    
    SA_CONTEXT: ClassVar[str] = """
## SOUTH AFRICAN CONTEXT

Apply SA-specific elements where relevant:

### Legal Framework
- **Constitution**: Reference relevant sections when applicable
- **POPIA**: For any data/privacy matters (Protection of Personal Information Act 4 of 2013)
- **CPA**: Consumer matters (Consumer Protection Act 68 of 2008)
- **LRA**: Employment/labour matters (Labour Relations Act 66 of 1995)
- **BCEA**: Working conditions (Basic Conditions of Employment Act 75 of 1997)
- **NCA**: Credit matters (National Credit Act 34 of 2005)
- **BBBEE**: Transformation requirements where relevant

### Business Context
- Currency: South African Rand (R or ZAR)
- Tax: VAT at 15%, SARS compliance
- Business registration: CIPC
- Banking: SA major banks (FNB, Standard Bank, Nedbank, Absa, Capitec)

### Dispute Resolution
- Mediation → Arbitration → CCMA (employment) or Courts
- Jurisdiction: Republic of South Africa

### Practical Realities
- 11 official languages (respect in formal address)
- Diverse cultural practices
- Urban/rural distinctions where relevant"""

    NO_SA_CONTEXT: ClassVar[str] = """
## CONTEXT NOTE
South African context is NOT specifically required for this document. Focus on universal/international standards unless the content requires SA-specific elements."""

    # =========================================================================
    # DOMAIN-SPECIFIC STRUCTURE BLOCKS
    # =========================================================================
    
    DOMAIN_STRUCTURES: ClassVar[dict[DocumentDomain, str]] = {
        DocumentDomain.LEGAL: """
## LEGAL DOCUMENT STRUCTURE

### Mandatory Elements:
1. **Title Block**: Document type, date, reference number
2. **Parties Section**: Full legal names, registration/ID numbers, addresses
3. **Recitals/Background**: "WHEREAS" clauses explaining context
4. **Definitions**: Clause 1 - define all capitalized terms
5. **Operative Provisions**: Numbered clauses (1, 1.1, 1.1.1 format)
6. **Schedules/Annexures**: Supporting documents referenced

### Legal Drafting Standards:
- Use defined terms consistently (capitalize when used as defined)
- Number ALL clauses and sub-clauses
- Use "shall" for obligations, "may" for permissions
- Include severability clause
- Specify governing law (South African law)
- Include dispute resolution mechanism
- Signature blocks with witness provisions
- Date format: [DAY] day of [MONTH] [YEAR]

### SA Legal Requirements:
- POPIA compliance for personal information processing
- CPA compliance for consumer contracts
- Plain language requirement (where applicable under CPA)
- Jurisdiction: Republic of South Africa courts""",

        DocumentDomain.BUSINESS: """
## BUSINESS DOCUMENT STRUCTURE

### Professional Format:
1. **Header**: Company letterhead details, date, reference
2. **Executive Summary**: Key points upfront (1 paragraph)
3. **Background/Context**: Situation analysis
4. **Main Content**: Logically organized sections
5. **Financials**: All amounts in ZAR, VAT status clear
6. **Timeline/Deliverables**: Clear dates and milestones
7. **Terms/Conditions**: Payment, validity, limitations
8. **Call to Action**: Clear next steps
9. **Contact Details**: Decision-maker contact info

### Business Writing Standards:
- Lead with value proposition/recommendation
- Use bullet points for lists (max 7 items)
- Tables for comparative data
- Active voice preferred
- Quantify claims where possible
- Include BBBEE status where relevant for tenders""",

        DocumentDomain.PERSONAL: """
## PERSONAL DOCUMENT STRUCTURE

### CV/Resume Format:
1. **Personal Details**: Name, contact (email, phone, LinkedIn)
2. **Professional Summary**: 3-4 lines capturing value proposition
3. **Key Skills**: 6-8 relevant competencies
4. **Experience**: Reverse chronological, achievement-focused
   - Company, Title, Dates
   - Key achievements with metrics
5. **Education**: Qualifications with dates
6. **Additional**: Certifications, languages, references

### Cover Letter Format:
1. **Header**: Your details, date, recipient details
2. **Salutation**: Research correct name
3. **Opening**: Hook + specific role/company
4. **Body**: 2-3 paragraphs linking experience to requirements
5. **Closing**: Call to action, availability
6. **Sign-off**: "Yours sincerely" (known name) / "Yours faithfully" (unknown)

### Writing Standards:
- Achievement-oriented (quantify: "increased sales by 25%")
- Action verbs (led, developed, implemented, achieved)
- Tailored to specific role/company
- Clean, professional formatting
- One page CV for < 10 years experience""",

        DocumentDomain.ACADEMIC: """
## ACADEMIC DOCUMENT STRUCTURE

### Scholarly Format:
1. **Title Page**: Title, author(s), institution, date
2. **Abstract**: 150-300 words summarizing entire work
3. **Keywords**: 5-7 relevant terms
4. **Introduction**: Background, problem statement, objectives, scope
5. **Literature Review**: Existing research, theoretical framework
6. **Methodology**: Research design, data collection, analysis methods
7. **Findings/Results**: Objective presentation of data
8. **Discussion**: Interpretation, implications, limitations
9. **Conclusion**: Summary, recommendations, future research
10. **References**: Consistent citation format (Harvard/APA/IEEE)
11. **Appendices**: Supplementary material

### Academic Standards:
- Formal, third-person perspective (or first-person if specified)
- Evidence-based arguments with proper citations
- Balanced analysis acknowledging limitations
- Avoid plagiarism - proper attribution""",

        DocumentDomain.GOVERNMENT: """
## GOVERNMENT/OFFICIAL DOCUMENT STRUCTURE

### Affidavit Format:
1. **Heading**: "AFFIDAVIT"
2. **Deponent Details**: Full name, ID, address, occupation
3. **Oath**: "I, the undersigned, do hereby make oath and state:"
4. **Numbered Statements**: Facts in numbered paragraphs
5. **Closing**: "I know and understand the contents of this affidavit..."
6. **Signature Block**: Deponent signature
7. **Commissioner's Section**: Commissioner of Oaths stamp/details

### Application/Form Format:
1. **Form Reference**: Department, form number
2. **Applicant Details**: As required by form
3. **Supporting Information**: As specified
4. **Declarations**: Required statements
5. **Attachments List**: Supporting documents

### Standards:
- Factual, precise language
- No opinions in affidavits (only facts within knowledge)
- Proper attestation
- Certified copies where required""",

        DocumentDomain.TECHNICAL: """
## TECHNICAL DOCUMENT STRUCTURE

### Documentation Format:
1. **Title/Version**: Document name, version number, date
2. **Overview**: Purpose and scope
3. **Prerequisites**: Requirements, dependencies
4. **Architecture/Design**: System overview, diagrams
5. **Implementation**: Step-by-step instructions
6. **API Reference** (if applicable): Endpoints, parameters, responses
7. **Configuration**: Settings, environment variables
8. **Examples**: Code samples, use cases
9. **Troubleshooting**: Common issues and solutions
10. **Changelog**: Version history

### Technical Writing Standards:
- Clear, precise technical language
- Code examples with syntax highlighting
- Step-by-step numbered instructions
- Document edge cases and limitations""",

        DocumentDomain.HEALTHCARE: """
## HEALTHCARE DOCUMENT STRUCTURE

### Medical Document Format:
1. **Header**: Healthcare provider details, date
2. **Patient Information**: Name, ID, contact (with consent)
3. **Clinical Details**: Relevant medical information
4. **Findings/Diagnosis**: Clinical observations
5. **Recommendations**: Treatment plan, referrals
6. **Disclaimer**: Medical advice limitations
7. **Practitioner Details**: Name, qualifications, registration number

### Standards:
- POPIA compliance for patient data
- HPCSA guidelines where applicable
- Clear, accurate medical terminology
- Patient-centered language""",

        DocumentDomain.FINANCIAL: """
## FINANCIAL DOCUMENT STRUCTURE

### Financial Report Format:
1. **Cover Page**: Report title, period, preparer
2. **Executive Summary**: Key financial highlights
3. **Financial Statements**: Balance sheet, income statement, cash flow
4. **Notes**: Accounting policies, significant items
5. **Analysis**: Ratios, trends, commentary
6. **Outlook**: Projections, risks

### Standards:
- IFRS/GAAP compliance where applicable
- All amounts in ZAR with consistent formatting
- Clear presentation of figures
- Audit status indication""",

        DocumentDomain.CREATIVE: """
## CREATIVE WRITING STRUCTURE

### Narrative Elements:
- **Hook**: Compelling opening
- **Character**: Believable, developing characters
- **Setting**: Vivid, sensory descriptions
- **Conflict**: Central tension driving narrative
- **Pacing**: Appropriate rhythm for genre
- **Voice**: Consistent narrative perspective
- **Resolution**: Satisfying conclusion

### Poetry Elements:
- Imagery and metaphor
- Rhythm and meter (if formal)
- Sound devices (alliteration, assonance)
- Line breaks for effect

### Standards:
- Show, don't tell
- Dialogue that reveals character
- Sensory details
- Genre-appropriate conventions""",

        DocumentDomain.GENERAL: """
## GENERAL DOCUMENT STRUCTURE

### Standard Format:
1. **Title/Header**: Clear identification of document purpose
2. **Introduction**: Context and purpose
3. **Main Content**: Logically organized sections with headings
4. **Supporting Details**: Evidence, examples, data
5. **Conclusion**: Summary and key takeaways
6. **Additional Information**: Appendices if needed

### Standards:
- Clear, professional language
- Logical organization
- Appropriate formatting for purpose""",
    }

    # =========================================================================
    # LANGUAGE-SPECIFIC GUIDANCE
    # =========================================================================
    
    LANGUAGE_GUIDANCE: ClassVar[dict[str, str]] = {
        "english": """
### English Language Standards:
- British English spelling (colour, organisation, labour)
- South African terminology where appropriate
- Formal register for professional documents
- Clear, concise sentence structure""",

        "afrikaans": """
### Afrikaanse Taalstandaarde:
- Korrekte Afrikaanse spelling en grammatika
- Formele register vir professionele dokumente
- SA Afrikaanse terme (nie Nederlandse alternatiewe nie)
- Inklusiewe taal waar toepaslik
- Korrekte gebruik van die tydvorme""",

        "zulu": """
### IsiZulu Language Standards:
- Correct isiZulu orthography and grammar
- Appropriate hlonipha (respect language) for formal contexts
- Proper noun class agreements (izibongo, abantu, etc.)
- SA isiZulu terminology for legal/business concepts
- Formal register: use respectful forms of address""",

        "xhosa": """
### IsiXhosa Language Standards:
- Correct isiXhosa spelling and grammar
- Appropriate respect registers (ukuhlonipha)
- Proper noun class concordance
- SA terminology for technical concepts
- Click consonants correctly represented""",

        "sotho": """
### Sesotho Language Standards:
- Correct Sesotho orthography
- Appropriate formal register (puo e hlomphehang)
- Proper grammar and agreement
- SA Sesotho terminology
- Respectful forms of address""",

        "tswana": """
### Setswana Language Standards:
- Correct Setswana spelling and grammar
- Appropriate formal register
- Proper noun class agreements
- SA Setswana terminology
- Respectful address forms (Rra, Mma)""",

        "venda": """
### Tshivenḓa Language Standards:
- Correct Tshivenḓa orthography
- Appropriate formal register
- Proper grammar including tone marking where needed
- SA terminology adaptations
- Respectful forms of address""",

        "tsonga": """
### Xitsonga Language Standards:
- Correct Xitsonga spelling
- Appropriate formal register
- Proper grammar
- SA Xitsonga terminology
- Formal greetings and closings""",

        "ndebele": """
### IsiNdebele Language Standards:
- Correct isiNdebele orthography
- Appropriate formal register
- Proper noun class agreements
- SA terminology
- Respectful address patterns""",

        "swati": """
### SiSwati Language Standards:
- Correct siSwati spelling and grammar
- Appropriate hlonipha register for formal contexts
- Proper noun class concordance
- SA siSwati terminology
- Royal/formal address where appropriate""",

        "pedi": """
### Sepedi Language Standards:
- Correct Sepedi (Northern Sotho) orthography
- Appropriate formal register
- Proper grammar
- SA Sepedi terminology
- Respectful forms of address""",
    }

    # =========================================================================
    # FORMALITY GUIDANCE
    # =========================================================================
    
    FORMALITY_GUIDANCE: ClassVar[dict[str, str]] = {
        "formal": """
### Formal Register:
- Professional, impersonal tone
- Complete sentences, no contractions
- Appropriate titles and honorifics
- Structured paragraphs
- No colloquialisms or slang
- Third person where appropriate""",

        "semi-formal": """
### Semi-Formal Register:
- Professional but approachable
- Contractions acceptable
- Direct address acceptable
- Clear, accessible language
- Some conversational elements permitted""",

        "casual": """
### Casual Register:
- Conversational, friendly tone
- Contractions and informal language
- Personal pronouns freely used
- Relaxed structure
- Colloquialisms acceptable if appropriate to audience""",
    }

    # =========================================================================
    # PROMPT BUILDER
    # =========================================================================

    @classmethod
    def build_prompt(
        cls,
        user_content: str,
        profile: DocumentProfile,
        language_code: str,
        language_name: str,
        formality: str,
        sa_context: bool,
        custom_instructions: str | None = None,
    ) -> str:
        """
        Build complete prompt from composable blocks.
        
        Args:
            user_content: User's document request
            profile: Classified document profile
            language_code: ISO language code
            language_name: Full language name
            formality: Formality level (formal, semi-formal, casual)
            sa_context: Include SA-specific context
            custom_instructions: Additional user requirements
            
        Returns:
            Complete prompt string for AI generation
        """
        
        # Create topic summary (first 150 chars)
        topic_summary = user_content[:150] + "..." if len(user_content) > 150 else user_content
        
        # Build system core
        system = cls.SYSTEM_CORE.format(
            language_name=language_name,
            topic_summary=topic_summary,
            formality=formality,
            document_type=profile.document_type.replace("_", " "),
        )
        
        # Add SA context if enabled
        context = cls.SA_CONTEXT if sa_context else cls.NO_SA_CONTEXT
        
        # Get domain structure
        structure = cls.DOMAIN_STRUCTURES.get(
            profile.domain, 
            cls.DOMAIN_STRUCTURES[DocumentDomain.GENERAL]
        )
        
        # Get language guidance
        lang_key = cls._normalize_language_code(language_code)
        lang_guidance = cls.LANGUAGE_GUIDANCE.get(lang_key, cls.LANGUAGE_GUIDANCE["english"])
        
        # Get formality guidance
        form_guidance = cls.FORMALITY_GUIDANCE.get(formality, cls.FORMALITY_GUIDANCE["formal"])
        
        # Custom instructions block
        custom = f"\n## ADDITIONAL REQUIREMENTS\n{custom_instructions}" if custom_instructions else ""
        
        # Assemble full prompt
        return f"""{system}
{context}
{structure}

## LANGUAGE REQUIREMENTS
{lang_guidance}

## FORMALITY
{form_guidance}
{custom}

## USER REQUEST

{user_content}

---

## OUTPUT INSTRUCTION

Generate the complete document now. Begin directly with the document content (title/heading first). Do not include explanations or meta-commentary."""

    @classmethod
    def _normalize_language_code(cls, code: str) -> str:
        """Normalize language code to guidance key"""
        mapping = {
            "zu": "zulu", "isizulu": "zulu",
            "xh": "xhosa", "isixhosa": "xhosa",
            "st": "sotho", "sesotho": "sotho",
            "tn": "tswana", "setswana": "tswana",
            "ve": "venda", "tshivenda": "venda",
            "ts": "tsonga", "xitsonga": "tsonga",
            "nr": "ndebele", "isindebele": "ndebele",
            "ss": "swati", "siswati": "swati",
            "nso": "pedi", "sepedi": "pedi",
            "af": "afrikaans",
            "en": "english",
        }
        return mapping.get(code.lower(), "english")
