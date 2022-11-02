public class MySampleApexClass {       //Class definition and body
   public static Integer myValue = 0;  //Class Member variable
   public static String myString = ''; //Class Member variable
   
   public static Integer getCalculatedValue () {
   // Method definition and body
   // do some calculation
      myValue = myValue+10;
      return myValue;
   }
   
   public static void increaseNumOfLocations (Lead lead) {
       lead.NumberOfLocations__c += 2;
   }
   
   public static Boolean isLeadExists (string name) {
       Lead lead = [SELECT Id, DepTestFormula__c FROM Lead WHERE Name = :name];
       return true;
   }
    
   public static void doLayoutThings (Test__c test) {
       List<Metadata.Metadata> fetched = Metadata.Operations.retrieve(
           Metadata.MetadataType.Layout,
           new List<String>{'Test__c-NewLayout'}
       );
       Metadata.Layout layout = (Metadata.Layout)fetched.get(0);
       String label = layout.summaryLayout.masterLabel;
       test.LayoutLabel__c = 'asd';
   }
}