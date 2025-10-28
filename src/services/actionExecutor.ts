export type ActionType = 'click' | 'input' | 'select' | 'wait' | 'scroll' | 'executeScript' | 'getText' | 'getAttribute' | 'findElement' | 'waitForElement';
export type SelectorType = 'id' | 'className' | 'css' | 'xpath' | 'text';

export interface ActionConfig {
  selector?: string;
  selectorType?: SelectorType;
  value?: string;
  waitTime?: number;
  script?: string;
  options?: any;
}

export interface ActionResult {
  success: boolean;
  result?: any;
  error?: string;
}

class ActionExecutor {
  private findElement(config: ActionConfig): HTMLElement | null {
    if (!config.selector) {
      throw new Error('Selector is required to find element');
    }

    switch (config.selectorType) {
      case 'id':
        return document.getElementById(config.selector);
      
      case 'className':
        return document.querySelector(`.${config.selector}`) as HTMLElement;
      
      case 'css':
        return document.querySelector(config.selector) as HTMLElement;
      
      case 'xpath':
        const xpathResult = document.evaluate(
          config.selector,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        return xpathResult.singleNodeValue as HTMLElement;
      
      case 'text':
        const allElements = document.querySelectorAll('*');
        for (const element of allElements) {
          if (element.textContent?.trim() === config.selector) {
            return element as HTMLElement;
          }
        }
        return null;
      
      default:
        return document.querySelector(config.selector) as HTMLElement;
    }
  }

  async click(config: ActionConfig): Promise<ActionResult> {
    try {
      const element = this.findElement(config);
      if (!element) {
        return { success: false, error: 'Element not found' };
      }

      element.click();
      return { success: true, result: 'Click executed successfully' };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async input(config: ActionConfig): Promise<ActionResult> {
    try {
      const element = this.findElement(config);
      if (!element) {
        return { success: false, error: 'Element not found' };
      }

      const inputElement = element as HTMLInputElement | HTMLTextAreaElement;
      
      if (!('value' in inputElement)) {
        return { success: false, error: 'Element is not an input element' };
      }

      if (config.value === undefined) {
        return { success: false, error: 'Value is required for input action' };
      }

      // Clear existing value
      inputElement.value = '';
      
      // Set new value
      inputElement.value = config.value;
      
      // Trigger input events
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
      inputElement.dispatchEvent(new Event('change', { bubbles: true }));

      return { success: true, result: `Input set to: ${config.value}` };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async select(config: ActionConfig): Promise<ActionResult> {
    try {
      const element = this.findElement(config);
      if (!element) {
        return { success: false, error: 'Element not found' };
      }

      const selectElement = element as HTMLSelectElement;
      
      if (selectElement.tagName !== 'SELECT') {
        return { success: false, error: 'Element is not a select element' };
      }

      if (config.value === undefined) {
        return { success: false, error: 'Value is required for select action' };
      }

      selectElement.value = config.value;
      selectElement.dispatchEvent(new Event('change', { bubbles: true }));

      return { success: true, result: `Selected option: ${config.value}` };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async wait(config: ActionConfig): Promise<ActionResult> {
    return new Promise((resolve) => {
      const waitTime = config.waitTime || 1000;
      setTimeout(() => {
        resolve({ success: true, result: `Waited for ${waitTime}ms` });
      }, waitTime);
    });
  }

  async scroll(config: ActionConfig): Promise<ActionResult> {
    try {
      if (config.options?.x !== undefined || config.options?.y !== undefined) {
        window.scrollTo(config.options.x || 0, config.options.y || 0);
        return { success: true, result: 'Scrolled to position' };
      } else if (config.selector) {
        const element = this.findElement(config);
        if (!element) {
          return { success: false, error: 'Element not found' };
        }
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return { success: true, result: 'Scrolled to element' };
      } else {
        return { success: false, error: 'No scroll target specified' };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async executeScript(config: ActionConfig): Promise<ActionResult> {
    try {
      if (!config.script) {
        return { success: false, error: 'Script is required for executeScript action' };
      }

      // Execute script in page context
      const result = eval(config.script);
      
      return { success: true, result };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async getText(config: ActionConfig): Promise<ActionResult> {
    try {
      const element = this.findElement(config);
      if (!element) {
        return { success: false, error: 'Element not found' };
      }

      const text = element.textContent?.trim() || '';
      return { success: true, result: text };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async getAttribute(config: ActionConfig): Promise<ActionResult> {
    try {
      const element = this.findElement(config);
      if (!element) {
        return { success: false, error: 'Element not found' };
      }

      if (!config.value) {
        return { success: false, error: 'Attribute name is required' };
      }

      const attributeValue = element.getAttribute(config.value);
      return { success: true, result: attributeValue || '' };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async findElementAction(config: ActionConfig): Promise<ActionResult> {
    try {
      const element = this.findElement(config);
      if (!element) {
        return { success: false, error: 'Element not found' };
      }

      return { 
        success: true, 
        result: {
          tagName: element.tagName,
          id: element.id,
          className: element.className,
          textContent: element.textContent?.trim()
        }
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async waitForElement(config: ActionConfig): Promise<ActionResult> {
    return new Promise((resolve) => {
      const waitTime = config.waitTime || 5000;
      const startTime = Date.now();
      
      const checkInterval = setInterval(() => {
        try {
          const element = this.findElement(config);
          
          if (element) {
            clearInterval(checkInterval);
            resolve({ success: true, result: 'Element found' });
            return;
          }

          if (Date.now() - startTime > waitTime) {
            clearInterval(checkInterval);
            resolve({ success: false, error: 'Element not found within timeout' });
          }
        } catch (error) {
          clearInterval(checkInterval);
          resolve({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }, 100);
    });
  }


  async executeAction(actionType: ActionType, config: ActionConfig): Promise<ActionResult> {
    switch (actionType) {
      case 'click':
        return this.click(config);
      
      case 'input':
        return this.input(config);
      
      case 'select':
        return this.select(config);
      
      case 'wait':
        return this.wait(config);
      
      case 'scroll':
        return this.scroll(config);
      
      case 'executeScript':
        return this.executeScript(config);
      
      case 'getText':
        return this.getText(config);
      
      case 'getAttribute':
        return this.getAttribute(config);
      
      case 'findElement':
        return this.findElementAction(config);
      
      case 'waitForElement':
        return this.waitForElement(config);
      
      default:
        return { success: false, error: 'Unknown action type' };
    }
  }
}

export const actionExecutor = new ActionExecutor();

