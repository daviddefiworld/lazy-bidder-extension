this is grok chat skill.
1. it got order with user text ( now user input filed in sidebar and click send button)
2. it create new chat from grok site
click a tag with data-testid is new-chat
3. add user text to input field
it needs to add text in <p> tag which is children of <div> tag with contenteditable is true
4. submit
click button with data-testid is chat-submit
5. wait until response is completed and send result to sidebar
It needs to hijack request - https://grok.com/rest/app-chat/conversations/new
6. sidebar show result