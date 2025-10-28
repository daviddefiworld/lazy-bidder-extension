# Control Panel Usage Guide

The LazyBidder extension now includes a powerful control panel that allows you to execute various actions on web pages and view the results in real-time.

## Features

### Action Types Available

1. **Find Element** 🔍 - Locate elements on the page
2. **Click** 🖱️ - Click on buttons, links, or any clickable element
3. **Input Text** ⌨️ - Enter text into input fields
4. **Select Option** 📋 - Select options from dropdown menus
5. **Wait** ⏱️ - Pause execution for a specified time
6. **Scroll** 📜 - Scroll to specific positions or elements
7. **Execute Script** ⚡ - Run custom JavaScript code
8. **Get Text** 📝 - Extract text content from elements
9. **Get Attribute** 🏷️ - Get attribute values from elements
10. **Wait for Element** ⏳ - Wait for an element to appear

### Selector Types

- **CSS Selector**: Use CSS selectors (e.g., `.button`, `#submit`, `div.container`)
- **ID**: Target elements by their ID attribute
- **Class Name**: Target elements by their CSS class name
- **XPath**: Use XPath expressions for complex element selection
- **Text Content**: Find elements by their exact text content

## How to Use

1. **Start the Extension**: Make sure the extension is running (status should show "Running")
2. **Select Action Type**: Choose the action you want to perform from the dropdown
3. **Configure Parameters**: Fill in the required fields based on the selected action
4. **Execute**: Click the "Execute" button to run the action
5. **View Results**: Check the Action Log section to see the results and any errors

## Examples

### Click a Button
- Action Type: `Click`
- Selector Type: `CSS Selector`
- Selector: `.submit-button`

### Input Text
- Action Type: `Input Text`
- Selector Type: `ID`
- Selector: `username`
- Input Value: `myusername`

### Get Element Text
- Action Type: `Get Text`
- Selector Type: `CSS Selector`
- Selector: `.price-display`

### Execute Custom Script
- Action Type: `Execute Script`
- JavaScript Code: `document.title = "Modified by LazyBidder"`

## Action Log

The Action Log displays:
- **Timestamp**: When the action was executed
- **Action Type**: What action was performed
- **Configuration**: The parameters used
- **Result**: Success/failure status and any returned data
- **Errors**: Detailed error messages if the action failed

## Tips

- Use browser developer tools to inspect elements and get accurate selectors
- Test selectors with simple actions like "Find Element" before using them with other actions
- The extension must be running to execute actions
- All actions are executed in the context of the current page
- Results are displayed in real-time in the log panel

## Troubleshooting

- **"Extension must be running"**: Start the extension using the main control button
- **"Element not found"**: Check your selector and make sure the element exists on the page
- **"No response received"**: The content script might not be loaded on the current page
- **Permission errors**: Some actions might be restricted by the website's security policies
