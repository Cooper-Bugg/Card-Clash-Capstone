# Software Requirements Specification (SRS)

# **1\. Introduction**

## **1.1 Purpose**

The system shall track user transactions and categorize them into a secure financial portfolio for everyday use.

## **1.2 Scope**

The purpose of the financial portfolio tracking system is to make analyzing and categorizing user transactions faster and easier. The system is based on local encrypted databases that keep user transaction history for budget and spending analytics. Using Artificial Intelligence to categorize transactions from bank statements makes it much simpler for the everyday person to use. Overall, we hope to provide a clean and simple way to track an individual’s spending habits.

## **1.3 Definitions, Acronyms, and Abbreviations**

List technical terms and their meanings.

## **1.4 References**

Link to related documents, standards, or sources.

- TinyLlama: Lightweight Large Language Model for transaction categorizing. 

# **2\. Overall Description**

## **2.1 Product Perspective**

This new system has similar competitors that offer some, but not all, of our features. Artificial Intelligence transaction categorizing and parsing bank statements are relatively unique features to our application. 

## **2.2 Product Functions**

The product will display multiple functionalities. Firstly, it shall display a clean Graphical User Interface for interacting with the program. Secondly, it shall store user spending and budget information in a secure database. Third, it shall track information about user-specified stock holdings. Fourth, it shall allow users to update this information. Finally, it shall display summaries of this information in a convenient, readable manner.

## **2.3 User Classes and Characteristics**

Any user with an interest to conveniently manage and track their finances will be able to use this application, their experience levels should not matter as anybody will have the ability to use our product efficiently once oriented. 

## **2.4 Operating Environment**

Hardware, software, and network requirements.

Connection to the internet

Any OS system from Windows 10 and beyond, Mac OS, etc.

## **2.5 Design and Implementation Constraints**

Programming languages, databases, regulations, etc.

- Python  
- SQLite Database

## **2.6 Assumptions and Dependencies**

Anything assumed to be true, or external systems relied on.

Database is always updated

Stock prices accurate to last time updated

# **3\. Specific Requirements**

## **3.1 Functional Requirements**

(1st) FR-1: The system shall allow users to log in using a valid username and password.

FR-2: The system shall allow users to reset their password using security questions.

FR-3: The system shall authenticate User using a stored hash of the associated password. 

FR-4: The system shall allow users to be created with a unique username and password.

FR-5: The system shall allow users to input transactions manually.

FR-6: The system shall store the formatted transaction into the local database.

FR-7: The system shall allow the user to upload transaction files.

FR-8: The system shall allow users to upload bank statements

FR-9: The system shall parse transaction files into transactions.

FR-10: The system shall parse bank statements.

FR-11: The system shall give the option to automatically categorize transactions.

FR-12: The system shall save transactions to the database.

FR- 13:The system shall display Transaction History.

FR-14: The system shall calculate statistics on spending-to-budget

FR-15: The system shall display statistics on spending-to-budget

FR-16: The system shall allow the user to edit the budget.

FR-17: The system shall allow the user to input new stock holdings.

FR-18: The system shall allow the user to add to existing stock holdings.

FR-19: The system shall allow the user to sell stock holdings.

FR-20: The system shall pull stock information from API.

FR-21: The system shall display stock performance.

FR-22: The system shall take inputted goals from the user. 

FR-23: The system shall store budget goals in the database. 

FR-24: The system shall compare user statistics to recorded goals.

FR-25: The system shall keep a local database for user data.

FR-26: The system shall take an encrypted database. 

FR-27: The system shall display a monthly report.

## **3.2 Non-Functional Requirements**

NFR-1: The system shall only handle one concurrent user.

NFR-2: The UI shall follow WCAG accessibility standards.

NFR-3: The system shall convert user PDFs to text within 5 seconds.

NFR-4: The system shall categorize transactions using AI at a rate of 10 transactions within 7 seconds.

## **3.3 Use Cases / User Stories**

Use Case: Submit Spending History  
Actors: Registered User  
Steps:  
1\. User inputs transactions.  
2\. Clicks ‘Submit Transactions’  
3\. System parses, stores, and categorizes transactions.

Use Case: Edit Budget  
Actors: Registered User  
Steps:  
1\. User clicks ‘Edit Budget’  
2\. User enters budget goals for each category.  
3\. User clicks ‘Save Changes’  
4\. System saves new budget goals.

Use Case: Submit Stock Holdings  
Actors: Registered User  
Steps:   
1\. User inputs stock holdings.  
2\. Clicks ‘Submit Holdings’  
3\. System tracks and shows stock portfolio performance.

Use Case: Get Reports  
Actors: Registered User  
Steps:  
1\. User clicks ‘Reports’  
2\. User selects from ‘Monthly Budget Report/Monthly Stock Portfolio Report’  
3\. Systems provided the requested report.

# **4\. Appendices**

Glossary  
UI mockups  
Diagrams (e.g., context or flow diagrams)

