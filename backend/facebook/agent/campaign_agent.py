"""
Campaign Agent Module
LangGraph-based AI agent for campaign creation and modification
"""
from typing import TypedDict, Annotated, Sequence
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from config import Config
import operator
import uuid


class CampaignState(TypedDict):
    """State for campaign creation workflow"""
    messages: Annotated[Sequence[BaseMessage], operator.add]
    campaign_id: str
    user_instructions: str
    
    # Campaign Level
    campaign_name: str
    objective: str
    
    # Ad Set Level
    ad_set_name: str
    daily_budget: str
    start_time: str
    end_time: str
    audience_location: str
    audience_age: str
    audience_gender: str
    placements: str
    
    # Ad Level
    ad_name: str
    headline: str
    primary_text: str  # ad_copy
    description: str   # link_description
    call_to_action: str
    destination_url: str
    creative_description: str # for AI generation context


def create_campaign_agent():
    """
    Create a LangGraph agent for campaign creation and modification
    """
    # Initialize OpenAI LLM
    llm = ChatOpenAI(
        model="gpt-4o-mini",
        api_key=Config.OPENAI_API_KEY,
        temperature=0.2
    )
    
    # Define agent workflow
    def generate_campaign_content(state: CampaignState) -> CampaignState:
        """
        Generate or modify campaign content based on user instructions
        """
        messages = state.get("messages", [])
        user_instructions = state.get("user_instructions", "")
        objective = state.get("objective", "engagement")
        target_audience = state.get("target_audience", "general audience")
        
        # Check if this is initial generation or modification
        is_modification = len(messages) > 0 and state.get("headline")
        
        current_state_desc = f"""
Current Campaign State:
- Campaign Name: {state.get('campaign_name', 'New Campaign')}
- Objective: {state.get('objective', objective)}

- Ad Set Name: {state.get('ad_set_name', 'New Ad Set')}
- Budget: {state.get('daily_budget', '1000 INR')}
- Location: {state.get('audience_location', 'India')}
- Age: {state.get('audience_age', '18-65+')}
- Gender: {state.get('audience_gender', 'All')}
- Placements: {state.get('placements', 'Advantage+')}

- Ad Name: {state.get('ad_name', 'New Ad')}
- Primary Text: {state.get('primary_text', '')}
- Headline: {state.get('headline', '')}
- Description: {state.get('description', '')}
- CTA: {state.get('call_to_action', 'Learn More')}
- URL: {state.get('destination_url', 'https://example.com')}
"""

        system_prompt = f"""You are an expert Facebook Ads Manager AI. Your goal is to help the user configure their Facebook Ad Campaign, Ad Set, and Ad Creative.

{current_state_desc}

User Instructions: {user_instructions}
Original Objective: {objective}
Original Audience: {target_audience}

Based on the user's instructions (and the original objective/audience if this is the start), generate or update the campaign configuration. 
If the user asks to change something (e.g. "Change headline to X", "Budget 500"), update ONLY that field and keep others consistent or optimized.
If the user provides vague instructions, use your expertise to fill in the best practices.

Respond in exactly this format (fill in all fields, reusing current values if not changed):

CAMPAIGN_NAME: [value]
OBJECTIVE: [value: OUTCOME_TRAFFIC, OUTCOME_SALES, OUTCOME_ENGAGEMENT, OUTCOME_AWARENESS, OUTCOME_LEADS, OUTCOME_APP_PROMOTION]

AD_SET_NAME: [value]
DAILY_BUDGET: [value e.g 1000 INR]
START_TIME: [value or "Now"]
END_TIME: [value or "Ongoing"]
AUDIENCE_LOCATION: [value]
AUDIENCE_AGE: [value]
AUDIENCE_GENDER: [value]
PLACEMENTS: [value]

AD_NAME: [value]
PRIMARY_TEXT: [value]
HEADLINE: [value]
DESCRIPTION: [value]
CALL_TO_ACTION: [value e.g. LEARN_MORE, SHOP_NOW, SIGN_UP, etc.]
DESTINATION_URL: [value]
CREATIVE_DESCRIPTION: [internal note on what creative works best]
"""
        
        # Call LLM
        response = llm.invoke([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_instructions if user_instructions else "Generate initial campaign structure"}
        ])
        
        # Parse response
        content = response.content
        
        # Extract fields
        extracted = {}
        for line in content.split("\n"):
            if ":" in line:
                key, val = line.split(":", 1)
                extracted[key.strip()] = val.strip()
        
        # Helper to safely get key
        def get_val(key, default):
            return extracted.get(key, default)

        campaign_name = get_val("CAMPAIGN_NAME", state.get("campaign_name", "New Campaign"))
        objective = get_val("OBJECTIVE", state.get("objective", objective))
        
        ad_set_name = get_val("AD_SET_NAME", state.get("ad_set_name", "New Ad Set"))
        daily_budget = get_val("DAILY_BUDGET", state.get("daily_budget", "1000 INR"))
        start_time = get_val("START_TIME", state.get("start_time", "Now"))
        end_time = get_val("END_TIME", state.get("end_time", "Ongoing"))
        audience_location = get_val("AUDIENCE_LOCATION", state.get("audience_location", "India"))
        audience_age = get_val("AUDIENCE_AGE", state.get("audience_age", "18-65+"))
        audience_gender = get_val("AUDIENCE_GENDER", state.get("audience_gender", "All"))
        placements = get_val("PLACEMENTS", state.get("placements", "Advantage+"))
        
        ad_name = get_val("AD_NAME", state.get("ad_name", "New Ad"))
        primary_text = get_val("PRIMARY_TEXT", state.get("primary_text", ""))
        headline = get_val("HEADLINE", state.get("headline", ""))
        description = get_val("DESCRIPTION", state.get("description", ""))
        call_to_action = get_val("CALL_TO_ACTION", state.get("call_to_action", "LEARN_MORE"))
        destination_url = get_val("DESTINATION_URL", state.get("destination_url", "https://example.com"))
        creative_description = get_val("CREATIVE_DESCRIPTION", state.get("creative_description", ""))
        
        # Update state
        updated_messages = list(messages)
        updated_messages.append(HumanMessage(content=user_instructions if user_instructions else "Generate/Update campaign"))
        updated_messages.append(AIMessage(content=content)) # Storing raw content for debugging/history
        
        return {
            **state,
            "messages": updated_messages,
            "campaign_name": campaign_name,
            "objective": objective,
            "ad_set_name": ad_set_name,
            "daily_budget": daily_budget,
            "start_time": start_time,
            "end_time": end_time,
            "audience_location": audience_location,
            "audience_age": audience_age,
            "audience_gender": audience_gender,
            "placements": placements,
            "ad_name": ad_name,
            "headline": headline,
            "primary_text": primary_text,
            "description": description,
            "call_to_action": call_to_action,
            "destination_url": destination_url,
            "creative_description": creative_description
        }
    
    # Build graph
    workflow = StateGraph(CampaignState)
    # Add nodes
    workflow.add_node("generate", generate_campaign_content)
    # Set entry point
    workflow.set_entry_point("generate")
    # Add edge to end
    workflow.add_edge("generate", END)
    # Compile
    app = workflow.compile()
    
    return app


# Create singleton instance
campaign_agent = create_campaign_agent()


async def generate_campaign(
    campaign_id: str = None,
    user_instructions: str = "",
    objective: str = "engagement",
    target_audience: str = "general audience",
    existing_state: dict = None
) -> dict:
    """
    Generate or modify campaign content using the agent
    """
    # Create initial state
    if existing_state:
        state = existing_state
        state["user_instructions"] = user_instructions
    else:
        state = {
            "messages": [],
            "campaign_id": campaign_id or str(uuid.uuid4()),
            "user_instructions": user_instructions,
            "campaign_name": "",
            "objective": objective,
            "ad_set_name": "",
            "daily_budget": "",
            "start_time": "",
            "end_time": "",
            "audience_location": "",
            "audience_age": "",
            "audience_gender": "",
            "placements": "",
            "ad_name": "",
            "headline": "",
            "primary_text": "",
            "description": "",
            "call_to_action": "",
            "destination_url": "",
            "creative_description": ""
        }
    
    # Run agent
    result = campaign_agent.invoke(state)
    
    # Format messages for frontend
    messages_list = []
    for msg in result.get("messages", []):
        if isinstance(msg, HumanMessage):
            messages_list.append(f"User: {msg.content}")
        elif isinstance(msg, AIMessage):
            messages_list.append(f"Agent: {msg.content}")
        else:
            messages_list.append(str(msg.content))
    
    return {
        "campaign_id": result.get("campaign_id"),
        "messages": messages_list,
        
        # Return all fields
        "campaign_name": result.get("campaign_name"),
        "objective": result.get("objective"),
        "ad_set_name": result.get("ad_set_name"),
        "daily_budget": result.get("daily_budget"),
        "start_time": result.get("start_time"),
        "end_time": result.get("end_time"),
        "audience_location": result.get("audience_location"),
        "audience_age": result.get("audience_age"),
        "audience_gender": result.get("audience_gender"),
        "placements": result.get("placements"),
        "ad_name": result.get("ad_name"),
        "headline": result.get("headline"),
        "primary_text": result.get("primary_text"),
        "description": result.get("description"),
        "call_to_action": result.get("call_to_action"),
        "destination_url": result.get("destination_url"),
        "creative_description": result.get("creative_description"),
    }
